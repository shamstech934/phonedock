import type { NormalizedPhone } from '../types';
import type { DiscoveredProductLink, ManufacturerParserPlugin, ParserContext } from './types';
import { absoluteUrl, jsonLdRows, metaContent, splitBrandModel, stripTags, titleText, uniqueLinks } from './html-utils';

const PHONE_TERMS = /(smartphone|mobile|phone|galaxy|iphone|pixel|redmi|poco|note|camon|spark|phantom|infinix|tecno|vivo|oppo|realme|honor|magic|oneplus|motorola|moto|nubia|redmagic|iqoo|xperia)/i;
const EXCLUDED = /(support|accessor|case|cover|charger|tablet|watch|buds|compare|business|offer|news|blog|login|account|cart)/i;

function imageFrom(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return imageFrom(value[0]);
  if (value && typeof value === 'object') return String((value as Record<string, unknown>).url || (value as Record<string, unknown>).contentUrl || '');
  return '';
}

function fromJsonLd(row: Record<string, unknown>, url: string, context: ParserContext): NormalizedPhone | null {
  const name = String(row.name || '').trim();
  if (!name) return null;
  const brandValue = row.brand || row.manufacturer;
  const brand = typeof brandValue === 'object' && brandValue
    ? String((brandValue as Record<string, unknown>).name || '')
    : String(brandValue || '');
  const identity = splitBrandModel(brand ? `${brand} ${name.replace(new RegExp(`^${brand}\\s+`, 'i'), '')}` : name, context.configuredBrands);
  if (!identity.brandName || !identity.model) return null;
  return {
    brandName: identity.brandName,
    model: identity.model,
    slug: '',
    thumbnail: imageFrom(row.image),
    images: imageFrom(row.image) ? [imageFrom(row.image)] : [],
    sourceUrl: String(row.url || url),
  };
}

export class GenericManufacturerParser implements ManufacturerParserPlugin {
  id = 'generic';
  domains: RegExp[] = [/.*/];
  supports(): boolean { return true; }

  discover(html: string, context: ParserContext): DiscoveredProductLink[] {
    const links: DiscoveredProductLink[] = [];
    for (const row of jsonLdRows(html)) {
      const parsed = fromJsonLd(row, context.sourceUrl, context);
      const rowUrl = String(row.url || '');
      if (parsed && rowUrl) links.push({ url: absoluteUrl(rowUrl, context.sourceUrl) || rowUrl, label: `${parsed.brandName} ${parsed.model}`, brandHint: parsed.brandName, modelHint: parsed.model, image: parsed.thumbnail });
    }

    const anchorPattern = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    for (const match of html.matchAll(anchorPattern)) {
      const href = match[1];
      const label = stripTags(match[2]);
      if (!href || label.length < 2 || label.length > 120) continue;
      if (!PHONE_TERMS.test(`${href} ${label}`) || EXCLUDED.test(`${href} ${label}`)) continue;
      const absolute = absoluteUrl(href, context.sourceUrl);
      if (!absolute) continue;
      const baseHost = new URL(context.sourceUrl).hostname.replace(/^www\./, '');
      if (!new URL(absolute).hostname.replace(/^www\./, '').endsWith(baseHost)) continue;
      const identity = splitBrandModel(label, context.configuredBrands);
      links.push({ url: absolute, label, brandHint: identity.brandName, modelHint: identity.model });
    }
    return uniqueLinks(links);
  }

  parseProduct(html: string, productUrl: string, context: ParserContext): NormalizedPhone | null {
    for (const row of jsonLdRows(html)) {
      const phone = fromJsonLd(row, productUrl, context);
      if (phone) return phone;
    }

    const title = metaContent(html, ['og:title', 'twitter:title']) || titleText(html);
    const image = metaContent(html, ['og:image', 'twitter:image']);
    const identity = splitBrandModel(title, context.configuredBrands);
    if (!identity.brandName || !identity.model || identity.model.length < 2) return null;
    if (EXCLUDED.test(identity.model) || !PHONE_TERMS.test(`${productUrl} ${title}`)) return null;
    return {
      brandName: identity.brandName,
      model: identity.model,
      slug: '',
      thumbnail: image,
      images: image ? [image] : [],
      sourceUrl: productUrl,
    };
  }
}
