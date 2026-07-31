import crypto from 'crypto';
import { News } from '@/lib/models';
import { sanitizeHtml } from '@/lib/sanitize';
import { validateUrlForFetch } from '@/lib/ssrf-guard';
import { stageLaunchCandidate } from '@/lib/launch-intelligence';

const MAX_FEEDS = 10;
const MAX_ITEMS_PER_FEED = 30;
const MAX_FEED_BYTES = 1_500_000;
const RUMOUR_TERMS = /\b(rumou?r|leak(?:ed|s)?|tip(?:ped|ster)?|expected|upcoming|unannounced|prototype|reportedly|launch(?:ing)?|certification)\b/i;
const PHONE_TERMS = /\b(phone|smartphone|mobile|android|iphone|galaxy|pixel|xiaomi|redmi|oppo|vivo|realme|oneplus|infinix|tecno|honor|huawei|motorola|nothing)\b/i;

interface FeedItem {
  title: string;
  link: string;
  description: string;
  publishedAt: Date | null;
}

function decodeXml(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
}

function textFromTag(block: string, names: string[]): string {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match) return decodeXml(match[1]).trim();
  }
  return '';
}

function linkFromBlock(block: string): string {
  const textLink = textFromTag(block, ['link']);
  if (/^https?:\/\//i.test(textLink)) return textLink.trim();
  return decodeXml(block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || '').trim();
}

export function parseRumourFeed(xml: string): FeedItem[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DTD/entity declarations are not allowed');
  return [...xml.matchAll(/<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi)]
    .slice(0, MAX_ITEMS_PER_FEED)
    .map((match) => {
      const block = match[1];
      const rawDate = textFromTag(block, ['pubDate', 'published', 'updated']);
      const date = rawDate ? new Date(rawDate) : null;
      return {
        title: textFromTag(block, ['title']).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        link: linkFromBlock(block),
        description: textFromTag(block, ['description', 'summary', 'content:encoded', 'content']),
        publishedAt: date && !Number.isNaN(date.getTime()) ? date : null,
      };
    })
    .filter((item) => item.title && /^https?:\/\//i.test(item.link));
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
}

export async function syncRumourFeeds() {
  const feeds = (process.env.RUMOUR_FEED_URLS || '').split(/[\n,]/)
    .map((value) => value.trim()).filter(Boolean).slice(0, MAX_FEEDS);
  const summary = { feeds: feeds.length, scanned: 0, imported: 0, candidates: 0, skipped: 0, errors: [] as string[] };

  for (const feedUrl of feeds) {
    let feedHost = '';
    try { feedHost = new URL(feedUrl).hostname; } catch { summary.errors.push('Invalid configured feed URL'); continue; }
    const safety = await validateUrlForFetch(feedUrl, [feedHost]);
    if (!safety.safe) { summary.errors.push(`${feedHost}: ${safety.reason}`); continue; }
    try {
      const response = await fetch(feedUrl, {
        signal: AbortSignal.timeout(15_000),
        headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (Number(response.headers.get('content-length') || 0) > MAX_FEED_BYTES) throw new Error('Feed is too large');
      const xml = (await response.text()).slice(0, MAX_FEED_BYTES);

      for (const item of parseRumourFeed(xml)) {
        summary.scanned++;
        const searchable = `${item.title} ${item.description.replace(/<[^>]+>/g, ' ')}`;
        if (!RUMOUR_TERMS.test(searchable) || !PHONE_TERMS.test(searchable)) { summary.skipped++; continue; }
        const ingestionKey = crypto.createHash('sha256').update(item.link).digest('hex');
        if (await News.exists({ ingestionKey })) { summary.skipped++; continue; }
        const excerpt = sanitizeHtml(item.description).replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ').trim().slice(0, 320);
        const baseSlug = slugify(item.title) || `rumour-${ingestionKey.slice(0, 12)}`;
        const slug = await News.exists({ slug: baseSlug }) ? `${baseSlug}-${ingestionKey.slice(0, 8)}` : baseSlug;
        const news = await News.create({
          title: item.title.slice(0, 220), slug, content: '', excerpt, category: 'Rumors',
          author: 'SpecsDekh News Desk', published: false, featured: false, status: 'pending',
          sourceName: feedHost, sourceUrl: item.link, sourcePublishedAt: item.publishedAt,
          autoImported: true, ingestionKey, confidence: 0.55,
          reviewNotes: 'Automatically imported. Verify the original source and facts before publishing.',
        });
        summary.imported++;
        try {
          const staged = await stageLaunchCandidate({
            title: item.title,
            description: excerpt,
            sourceNewsId: news._id,
            sourceName: feedHost,
            sourceUrl: item.link,
            sourcePublishedAt: item.publishedAt,
          });
          if (staged.created) summary.candidates++;
        } catch (candidateError) {
          summary.errors.push(`${feedHost}: candidate staging failed (${candidateError instanceof Error ? candidateError.message : 'unknown error'})`);
        }
      }
    } catch (error) {
      summary.errors.push(`${feedHost}: ${error instanceof Error ? error.message : 'Feed sync failed'}`);
    }
  }
  return summary;
}
