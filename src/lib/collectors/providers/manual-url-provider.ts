import { BaseProvider, ProviderFetchResult } from './base';
import type { NormalizedPhone } from '../types';

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, ' '));
}

function collectJsonLd(node: unknown, rows: Record<string, unknown>[]): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(item => collectJsonLd(item, rows)); return; }
  const record = node as Record<string, unknown>;
  const type = String(record['@type'] || '').toLowerCase();
  if (type === 'product') rows.push(record);
  if (type === 'itemlist' && Array.isArray(record.itemListElement)) collectJsonLd(record.itemListElement, rows);
  if (record.item) collectJsonLd(record.item, rows);
  if (record['@graph']) collectJsonLd(record['@graph'], rows);
}

function splitBrandModel(name: string, configuredBrands: string[]): { brandName: string; model: string } {
  const clean = name.replace(/\s+/g, ' ').trim();
  const brand = configuredBrands.find(value => clean.toLowerCase().startsWith(`${value.toLowerCase()} `));
  if (brand) return { brandName: brand, model: clean.slice(brand.length).trim() };
  const [first, ...rest] = clean.split(' ');
  return { brandName: first || '', model: rest.join(' ') || clean };
}

export class ManualUrlProvider extends BaseProvider {
  async fetch(): Promise<ProviderFetchResult> {
    const url = this.config.endpoint;
    if (!url) return { phones: [], hasNextPage: false, providerErrors: ['No URL configured'] };

    const response = await this.fetchWithTimeout(url, { headers: { Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8' } });
    if (!response.ok) return { phones: [], hasNextPage: false, providerErrors: [`HTTP ${response.status}`] };

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('json')) {
      let data: unknown;
      try { data = JSON.parse(await this.readTextLimited(response)); }
      catch { return { phones: [], hasNextPage: false, providerErrors: ['Invalid JSON response from source'] }; }
      const phones: Record<string, unknown>[] = [];
      const tryExtract = (obj: unknown, depth = 0): void => {
        if (depth > 5 || obj == null || typeof obj !== 'object') return;
        if (Array.isArray(obj)) { obj.forEach(item => tryExtract(item, depth + 1)); return; }
        const record = obj as Record<string, unknown>;
        const brand = record.brand || record.brandName || record.manufacturer;
        const model = record.model || record.modelName || record.name || record.title;
        if (brand && model) { phones.push(record); return; }
        for (const value of Object.values(record)) tryExtract(value, depth + 1);
      };
      tryExtract(data);
      const normalized = phones.map(raw => this.normalizeRecord(raw)).filter((phone): phone is NormalizedPhone => Boolean(phone));
      return normalized.length
        ? { phones: this.applyBrandFilter(normalized), hasNextPage: false, providerErrors: [] }
        : { phones: [], hasNextPage: false, providerErrors: ['No phone-like records found in JSON response'] };
    }

    const html = await this.readTextLimited(response);
    const rows: Record<string, unknown>[] = [];
    const scriptPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    for (const match of html.matchAll(scriptPattern)) {
      try { collectJsonLd(JSON.parse(match[1].trim()), rows); } catch { /* ignore invalid blocks */ }
    }

    const phones: NormalizedPhone[] = [];
    for (const row of rows) {
      const name = String(row.name || '').trim();
      if (!name) continue;
      const brandValue = row.brand;
      const brandName = typeof brandValue === 'object' && brandValue
        ? String((brandValue as Record<string, unknown>).name || '')
        : String(brandValue || '');
      const identity = brandName ? { brandName, model: name.replace(new RegExp(`^${brandName}\\s+`, 'i'), '') } : splitBrandModel(name, this.config.brandFilter || []);
      const image = Array.isArray(row.image) ? row.image[0] : row.image;
      phones.push({
        brandName: identity.brandName.trim(), model: identity.model.trim(),
        slug: this.generateSlug(identity.brandName, identity.model),
        thumbnail: typeof image === 'object' && image ? String((image as Record<string, unknown>).url || '') : String(image || ''),
        sourceUrl: String(row.url || url),
      });
    }

    if (!phones.length) {
      const configuredBrands = this.config.brandFilter || [];
      const base = new URL(url);
      const linkPattern = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      const seen = new Set<string>();
      for (const match of html.matchAll(linkPattern)) {
        const label = stripTags(match[2]);
        if (label.length < 3 || label.length > 100) continue;
        const href = match[1];
        if (!/(smartphone|mobile|phone|galaxy|iphone|pixel|redmi|note|camon|spark|infinix|tecno|vivo|oppo|realme)/i.test(`${href} ${label}`)) continue;
        const identity = splitBrandModel(label, configuredBrands);
        if (!identity.brandName || !identity.model || identity.model.toLowerCase() === identity.brandName.toLowerCase()) continue;
        const absoluteUrl = new URL(href, base).toString();
        const key = `${identity.brandName}|${identity.model}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        phones.push({ brandName: identity.brandName, model: identity.model, slug: this.generateSlug(identity.brandName, identity.model), sourceUrl: absoluteUrl });
        if (phones.length >= 250) break;
      }
    }

    const filtered = this.applyBrandFilter(phones.filter(phone => phone.brandName && phone.model));
    if (!filtered.length) {
      return { phones: [], hasNextPage: false, providerErrors: ['No structured phone records found. Use a JSON/CSV/RSS feed or a supported manufacturer page.'] };
    }
    return { phones: filtered, hasNextPage: false, providerErrors: [] };
  }

  private normalizeRecord(raw: Record<string, unknown>): NormalizedPhone | null {
    const brandName = String(raw.brand || raw.brandName || raw.manufacturer || '').trim();
    const model = String(raw.model || raw.modelName || raw.name || raw.title || '').trim();
    if (!brandName || !model) return null;
    return {
      brandName, model, slug: this.generateSlug(brandName, model),
      thumbnail: String(raw.thumbnail || raw.image || raw.imageUrl || ''),
      display: { size: String(raw.display || raw.displaySize || '') },
      processor: { chipset: String(raw.chipset || '') },
      memory: { ram: String(raw.ram || ''), storage: String(raw.storage || '') },
      battery: { capacity: String(raw.battery || '') },
      body: { weight: String(raw.weight || '') },
      software: { os: String(raw.os || '') },
      sourceUrl: String(raw.url || raw.sourceUrl || this.config.endpoint || ''),
    };
  }
}
