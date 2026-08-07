import type { DiscoveredProductLink, ManufacturerParserPlugin, ParserContext } from './types';
import type { NormalizedPhone } from '../types';
import { absoluteUrl, metaContent, stripTags, uniqueLinks } from './html-utils';
import { GenericManufacturerParser } from './generic-parser';
import { classifyCollectorPage, normalizeCollectedModelName } from '../page-classifier';

export class SamsungParser implements ManufacturerParserPlugin {
  id = 'samsung';
  domains = [/^(?:www\.)?samsung\.com$/i];
  private generic = new GenericManufacturerParser();
  supports(url: URL): boolean { return this.domains.some(pattern => pattern.test(url.hostname)); }

  discover(html: string, context: ParserContext): DiscoveredProductLink[] {
    const links = this.generic.discover(html, context);
    const patterns = [
      /<a\b[^>]*href=["']([^"']*\/smartphones\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      /["']url["']\s*:\s*["']([^"']*\/smartphones\/[^"']+)["']/gi,
    ];
    for (const pattern of patterns) {
      for (const match of html.matchAll(pattern)) {
        const url = absoluteUrl(match[1], context.sourceUrl);
        if (!url || /\/smartphones\/?$/i.test(new URL(url).pathname)) continue;
        if (classifyCollectorPage({ url, title: match[2] ? stripTags(match[2]) : '', sourceName: context.sourceName }).kind !== 'product') continue;
        const label = match[2] ? stripTags(match[2]) : '';
        links.push({ url, label, brandHint: 'Samsung', modelHint: label.replace(/^Samsung\s+/i, '') });
      }
    }
    return uniqueLinks(links, 250);
  }

  parseProduct(html: string, productUrl: string, context: ParserContext): NormalizedPhone | null {
    if (classifyCollectorPage({ url: productUrl, html, sourceName: context.sourceName }).kind !== 'product') return null;
    const generic = this.generic.parseProduct(html, productUrl, { ...context, configuredBrands: ['Samsung'] });
    if (generic) {
      generic.brandName = 'Samsung';
      generic.model = normalizeCollectedModelName('Samsung', generic.model.replace(/^Samsung\s+/i, '').replace(/\s*\|.*$/, '').trim());
      return generic;
    }
    const title = metaContent(html, ['og:title', 'twitter:title']);
    if (!title) return null;
    const image = metaContent(html, ['og:image', 'twitter:image']);
    const model = normalizeCollectedModelName('Samsung', title.replace(/^Samsung\s+/i, '').replace(/\s*\|.*$/, '').trim());
    if (!/galaxy/i.test(model)) return null;
    return { brandName: 'Samsung', model, slug: '', thumbnail: image, images: image ? [image] : [], sourceUrl: productUrl };
  }
}
