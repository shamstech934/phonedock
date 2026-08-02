import { BaseProvider, ProviderFetchResult } from './base';
import type { NormalizedPhone } from '../types';
import { getManufacturerParser } from '../parsers/registry';
import type { ParserContext } from '../parsers/types';

function normalizePhone(phone: NormalizedPhone | null, generateSlug: (brand: string, model: string) => string): NormalizedPhone | null {
  if (!phone) return null;
  const brandName = String(phone.brandName || '').replace(/\s+/g, ' ').trim();
  const model = String(phone.model || '').replace(/\s+/g, ' ').trim();
  if (!brandName || !model || model.length < 2) return null;
  return {
    ...phone,
    brandName,
    model,
    slug: phone.slug || generateSlug(brandName, model),
    images: Array.from(new Set((phone.images || []).filter(Boolean))),
    thumbnail: phone.thumbnail || phone.images?.[0] || '',
  };
}

export class ManualUrlProvider extends BaseProvider {
  async fetch(): Promise<ProviderFetchResult> {
    const url = this.config.endpoint;
    if (!url) return { phones: [], hasNextPage: false, providerErrors: ['No URL configured'] };

    const context: ParserContext = {
      sourceUrl: url,
      configuredBrands: this.config.brandFilter || [],
      sourceName: this.sourceName,
    };

    const response = await this.fetchWithTimeout(url, { headers: { Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8' } });
    if (!response.ok) return { phones: [], hasNextPage: false, providerErrors: [`Catalog page returned HTTP ${response.status}`] };

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('json')) return this.fetchJsonResponse(response);

    const html = await this.readTextLimited(response);
    const parser = getManufacturerParser(url);
    const discovered = parser.discover(html, context);
    const phones: NormalizedPhone[] = [];
    const warnings: string[] = [];

    // Some catalog pages expose complete Product JSON-LD. Parse the catalog itself first.
    const catalogPhone = normalizePhone(parser.parseProduct(html, url, context), this.generateSlug.bind(this));
    if (catalogPhone && discovered.length === 0) phones.push(catalogPhone);

    const productPageLimit = Math.max(1, Math.min(50, Number(this.config.maxProductPages || process.env.COLLECTOR_PRODUCT_PAGE_LIMIT || 20)));
    for (const candidate of discovered.slice(0, productPageLimit)) {
      try {
        const productResponse = await this.fetchWithTimeout(candidate.url, { headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' } });
        if (!productResponse.ok) {
          warnings.push(`${candidate.url}: HTTP ${productResponse.status}`);
          continue;
        }
        const productHtml = await this.readTextLimited(productResponse);
        let parsed = parser.parseProduct(productHtml, candidate.url, context);
        if (!parsed && candidate.brandHint && candidate.modelHint) {
          parsed = {
            brandName: candidate.brandHint,
            model: candidate.modelHint,
            slug: '',
            thumbnail: candidate.image || '',
            images: candidate.image ? [candidate.image] : [],
            sourceUrl: candidate.url,
          };
        }
        const phone = parsed ? normalizePhone(parsed, this.generateSlug.bind(this)) : null;
        if (phone) phones.push(phone);
        else warnings.push(`${candidate.url}: product identity could not be confirmed`);
      } catch (error: unknown) {
        warnings.push(`${candidate.url}: ${error instanceof Error ? error.message : 'request failed'}`);
      }
    }

    const unique = new Map<string, NormalizedPhone>();
    for (const phone of phones) unique.set(`${phone.brandName}|${phone.model}`.toLowerCase(), phone);
    const filtered = this.applyBrandFilter([...unique.values()]);

    if (!filtered.length) {
      const detail = discovered.length
        ? `Discovered ${discovered.length} possible product links, but none produced a confirmed phone record.`
        : `No product links or Product JSON-LD were exposed by this page.`;
      return {
        phones: [],
        hasNextPage: false,
        providerErrors: [`${detail} Parser: ${parser.id}. Use a JSON/CSV/RSS feed or configure a brand-specific parser if the site renders products only in JavaScript.`],
      };
    }

    // Warnings are useful diagnostics but should not turn a productive job into failure.
    return { phones: filtered, hasNextPage: false, providerErrors: warnings.slice(0, 20) };
  }

  private async fetchJsonResponse(response: Response): Promise<ProviderFetchResult> {
    let data: unknown;
    try { data = JSON.parse(await this.readTextLimited(response)); }
    catch { return { phones: [], hasNextPage: false, providerErrors: ['Invalid JSON response from source'] }; }

    const rawPhones: Record<string, unknown>[] = [];
    const visit = (obj: unknown, depth = 0): void => {
      if (depth > 7 || obj == null || typeof obj !== 'object') return;
      if (Array.isArray(obj)) { obj.forEach(item => visit(item, depth + 1)); return; }
      const record = obj as Record<string, unknown>;
      const brand = record.brand || record.brandName || record.manufacturer;
      const model = record.model || record.modelName || record.name || record.title;
      if (brand && model) rawPhones.push(record);
      else Object.values(record).forEach(value => visit(value, depth + 1));
    };
    visit(data);

    const normalized = rawPhones
      .map(raw => this.normalizeRecord(raw))
      .filter((phone): phone is NormalizedPhone => Boolean(phone));
    const filtered = this.applyBrandFilter(normalized);
    return filtered.length
      ? { phones: filtered, hasNextPage: false, providerErrors: [] }
      : { phones: [], hasNextPage: false, providerErrors: ['No phone-like records found in JSON response'] };
  }

  private normalizeRecord(raw: Record<string, unknown>): NormalizedPhone | null {
    const brandName = String(raw.brand || raw.brandName || raw.manufacturer || '').trim();
    const model = String(raw.model || raw.modelName || raw.name || raw.title || '').trim();
    if (!brandName || !model) return null;
    const image = String(raw.thumbnail || raw.image || raw.imageUrl || '');
    return {
      brandName,
      model,
      slug: this.generateSlug(brandName, model),
      thumbnail: image,
      images: image ? [image] : [],
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
