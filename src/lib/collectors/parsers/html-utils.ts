export function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/gi, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripTags(value: string): string {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

export function absoluteUrl(href: string, baseUrl: string): string | null {
  try { return new URL(href, baseUrl).toString(); } catch { return null; }
}

export function collectJsonLd(node: unknown, rows: Record<string, unknown>[]): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(item => collectJsonLd(item, rows)); return; }
  const record = node as Record<string, unknown>;
  const rawType = record['@type'];
  const types = Array.isArray(rawType) ? rawType.map(String) : [String(rawType || '')];
  if (types.some(type => type.toLowerCase() === 'product')) rows.push(record);
  if (record.itemListElement) collectJsonLd(record.itemListElement, rows);
  if (record.item) collectJsonLd(record.item, rows);
  if (record['@graph']) collectJsonLd(record['@graph'], rows);
  if (record.mainEntity) collectJsonLd(record.mainEntity, rows);
}

export function jsonLdRows(html: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const raw = match[1].trim();
    if (!raw) continue;
    try { collectJsonLd(JSON.parse(raw), rows); } catch { /* invalid block */ }
  }
  return rows;
}

export function metaContent(html: string, names: string[]): string {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const forward = new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i');
    const reverse = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["']`, 'i');
    const match = html.match(forward) || html.match(reverse);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return '';
}

export function titleText(html: string): string {
  return stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
}

export function splitBrandModel(name: string, configuredBrands: string[]): { brandName: string; model: string } {
  let clean = decodeHtml(name).replace(/\s+/g, ' ').trim();
  clean = clean.replace(/\s*[|–—-]\s*(Samsung|Apple|Xiaomi|OPPO|vivo|realme|HONOR|OnePlus|Motorola|Google Store|Official Site).*$/i, '').trim();
  const brand = configuredBrands.find(value => clean.toLowerCase().startsWith(`${value.toLowerCase()} `));
  if (brand) return { brandName: brand, model: clean.slice(brand.length).trim() };
  if (configuredBrands.length === 1) return { brandName: configuredBrands[0], model: clean.replace(new RegExp(`^${configuredBrands[0]}\\s+`, 'i'), '').trim() };
  const [first, ...rest] = clean.split(' ');
  return { brandName: first || '', model: rest.join(' ') || clean };
}

export function uniqueLinks<T extends { url: string }>(links: T[], limit = 250): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const link of links) {
    const normalized = link.url.replace(/[#?].*$/, '').replace(/\/$/, '').toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(link);
    if (result.length >= limit) break;
  }
  return result;
}
