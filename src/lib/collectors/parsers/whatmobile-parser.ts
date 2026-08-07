import type { DiscoveredProductLink, ManufacturerParserPlugin, ParserContext } from './types';
import type { NormalizedPhone } from '../types';
import { absoluteUrl, metaContent, stripTags, uniqueLinks } from './html-utils';
import { classifyCollectorPage, normalizeCollectedModelName } from '../page-classifier';

const PRODUCT_PATH = /^[a-z0-9]+_[a-z0-9]+(?:-[a-z0-9]+)*$/i;

function identityFromPath(url: string): { brandName: string; model: string } | null {
  try {
    const tail = new URL(url).pathname.split('/').filter(Boolean).at(-1) || '';
    if (!PRODUCT_PATH.test(tail)) return null;
    const [brand, ...modelParts] = tail.split('_');
    const model = modelParts.join(' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    return brand && model ? { brandName: brand, model } : null;
  } catch { return null; }
}

export class WhatMobileParser implements ManufacturerParserPlugin {
  id = 'whatmobile';
  domains = [/^(?:www\.)?whatmobile\.com\.pk$/i];
  supports(url: URL): boolean { return this.domains.some(pattern => pattern.test(url.hostname)); }

  discover(html: string, context: ParserContext): DiscoveredProductLink[] {
    const links: DiscoveredProductLink[] = [];
    const anchorPattern = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    for (const match of html.matchAll(anchorPattern)) {
      const url = absoluteUrl(match[1], context.sourceUrl);
      if (!url) continue;
      let parsed: URL;
      try { parsed = new URL(url); } catch { continue; }
      if (parsed.hostname.replace(/^www\./, '') !== 'whatmobile.com.pk') continue;
      const classification = classifyCollectorPage({ url, title: stripTags(match[2]), sourceName: context.sourceName });
      if (classification.kind !== 'product') continue;
      const identity = identityFromPath(url);
      if (!identity) continue;
      links.push({ url, label: stripTags(match[2]) || `${identity.brandName} ${identity.model}`, brandHint: identity.brandName, modelHint: identity.model });
    }
    return uniqueLinks(links, 500);
  }

  parseProduct(html: string, productUrl: string, context: ParserContext): NormalizedPhone | null {
    const classification = classifyCollectorPage({ url: productUrl, html, sourceName: context.sourceName });
    if (classification.kind !== 'product') return null;
    const identity = identityFromPath(productUrl);
    if (!identity) return null;
    const title = metaContent(html, ['og:title', 'twitter:title']);
    const image = metaContent(html, ['og:image', 'twitter:image']);
    const titleModel = title ? normalizeCollectedModelName(identity.brandName, title) : '';
    return {
      brandName: identity.brandName,
      model: titleModel || identity.model,
      slug: '',
      thumbnail: image,
      images: image ? [image] : [],
      sourceUrl: productUrl,
    };
  }
}
