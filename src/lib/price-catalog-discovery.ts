import { validateUrlForFetch } from '@/lib/ssrf-guard';
import { fetchRetailProductPage } from '@/lib/retailer-fetch';

const MAX_INPUT_URLS = 12;
const MAX_DISCOVERED_URLS = 500;
const MAX_RESPONSE_BYTES = 3_000_000;
const FETCH_TIMEOUT_MS = 10_000;

export interface CatalogDiscoveryInput {
  mode: string;
  catalogUrls?: string[];
  sitemapUrls?: string[];
  feedUrl?: string;
  allowedDomains: string[];
}

export interface CatalogDiscoveryResult {
  urls: string[];
  errors: string[];
  fetched: number;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function extractLocsFromXml(xml: string): string[] {
  return [...xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)]
    .map(match => decodeXml(match[1].trim()))
    .filter(Boolean);
}

export function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*?href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi)) {
    const href = decodeXml(match[1] || match[2] || match[3] || '').trim();
    if (!href || href.startsWith('#') || /^(?:javascript|data|mailto|tel):/i.test(href)) continue;
    try { links.push(new URL(href, baseUrl).toString()); } catch { /* malformed link */ }
  }
  return links;
}

function collectJsonUrls(value: unknown, output: string[], depth = 0): void {
  if (depth > 8 || output.length >= MAX_DISCOVERED_URLS) return;
  if (Array.isArray(value)) {
    value.forEach(item => collectJsonUrls(item, output, depth + 1));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/^(?:url|productUrl|product_url|link|permalink)$/i.test(key) && typeof child === 'string') output.push(child);
    else collectJsonUrls(child, output, depth + 1);
    if (output.length >= MAX_DISCOVERED_URLS) return;
  }
}

export function isProbableProductUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return false;
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length < 2) return false;
    const tail = segments.at(-1) || '';
    if (/^(?:mobiles?|phones?|smartphones?|products?|shop|store|category|collections?|catalog|search|brands?)$/i.test(tail)) return false;
    return /\d/.test(tail) || tail.split(/[-_]/).filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}

async function fetchText(url: string, allowedDomains: string[]): Promise<string> {
  const validation = await validateUrlForFetch(url, allowedDomains);
  if (!validation.safe) throw new Error(validation.reason || 'Unsafe URL');
  const fetched = await fetchRetailProductPage(url, {
    timeoutMs: FETCH_TIMEOUT_MS,
    maxBytes: MAX_RESPONSE_BYTES,
  });
  if (!fetched.ok) throw new Error(fetched.error);
  return fetched.html;
}

function uniqueAllowedProductUrls(values: string[], allowedDomains: string[]): string[] {
  const allowed = allowedDomains.map(value => value.toLowerCase().replace(/^www\./, '').replace(/^\./, ''));
  return [...new Set(values)].filter(value => {
    if (!isProbableProductUrl(value)) return false;
    try {
      const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
      return allowed.some(domain => host === domain || host.endsWith(`.${domain}`));
    } catch { return false; }
  }).slice(0, MAX_DISCOVERED_URLS);
}

export async function discoverCatalogProductUrls(input: CatalogDiscoveryInput): Promise<CatalogDiscoveryResult> {
  const errors: string[] = [];
  const discovered: string[] = [];
  let fetched = 0;
  const mode = input.mode || 'manual';
  const roots = mode === 'sitemap' ? input.sitemapUrls || []
    : mode === 'catalog' ? input.catalogUrls || []
      : (mode === 'feed' || mode === 'api') && input.feedUrl ? [input.feedUrl] : [];

  for (const root of roots.filter(Boolean).slice(0, MAX_INPUT_URLS)) {
    try {
      const body = await fetchText(root, input.allowedDomains); fetched++;
      if (mode === 'catalog') discovered.push(...extractLinksFromHtml(body, root));
      else if (mode === 'api' || (mode === 'feed' && /^[\s\r\n]*[\[{]/.test(body))) {
        const jsonUrls: string[] = [];
        collectJsonUrls(JSON.parse(body), jsonUrls);
        for (const url of jsonUrls) {
          try { discovered.push(new URL(url, root).toString()); } catch { /* invalid feed URL */ }
        }
      } else {
        const locs = extractLocsFromXml(body);
        const sitemapChildren = locs.filter(url => /(?:sitemap|\.xml)(?:$|\?)/i.test(url)).slice(0, MAX_INPUT_URLS);
        discovered.push(...locs.filter(url => !sitemapChildren.includes(url)));
        if (mode === 'sitemap') {
          for (const child of sitemapChildren) {
            try { discovered.push(...extractLocsFromXml(await fetchText(child, input.allowedDomains))); fetched++; }
            catch (error) { errors.push(`${child}: ${error instanceof Error ? error.message : 'Fetch failed'}`); }
          }
        }
      }
    } catch (error) {
      errors.push(`${root}: ${error instanceof Error ? error.message : 'Discovery failed'}`);
    }
  }
  return { urls: uniqueAllowedProductUrls(discovered, input.allowedDomains), errors: errors.slice(0, 10), fetched };
}

function normalizedTokens(value: string): string[] {
  return decodeURIComponent(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(token => token.length > 1);
}

export function matchProductUrlToPhone<T extends { slug?: string; modelName?: string }>(url: string, phones: T[]): T | null {
  let path = '';
  try { path = new URL(url).pathname; } catch { return null; }
  const pathTokens = new Set(normalizedTokens(path));
  const scored = phones.map(phone => {
    const phoneTokens = [...new Set(normalizedTokens(`${phone.slug || ''} ${phone.modelName || ''}`))];
    const significant = phoneTokens.filter(token => !['samsung', 'apple', 'xiaomi', 'phone', 'mobile', 'galaxy'].includes(token));
    const matched = significant.filter(token => pathTokens.has(token));
    const digitTokens = significant.filter(token => /\d/.test(token));
    const digitsMatch = digitTokens.length === 0 || digitTokens.every(token => pathTokens.has(token));
    return { phone, score: significant.length ? matched.length / significant.length : 0, matched: matched.length, digitsMatch };
  }).filter(item => item.digitsMatch && item.matched >= 1 && item.score >= 0.6)
    .sort((a, b) => b.score - a.score || b.matched - a.matched);
  if (!scored[0]) return null;
  if (scored[1] && scored[0].score === scored[1].score && scored[0].matched === scored[1].matched) return null;
  return scored[0].phone;
}
