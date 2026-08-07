import { BaseProvider, ProviderFetchResult } from './base';
import type { NormalizedPhone } from '../types';
import { getManufacturerParser } from '../parsers/registry';
import type { ParserContext } from '../parsers/types';
import { classifyCollectorPage, normalizeCollectedModelName } from '../page-classifier';


const NON_PRODUCT_ASSET_RE = /\.(?:pdf|zip|rar|7z|docx?|xlsx?|pptx?|jpe?g|png|gif|webp|svg|ico|mp4|webm|mp3|wav)(?:$|[?#])/i;

function isNonProductAsset(url: string): boolean {
  try { return NON_PRODUCT_ASSET_RE.test(new URL(url).pathname); }
  catch { return NON_PRODUCT_ASSET_RE.test(url); }
}

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
  async fetch(page: number = 1): Promise<ProviderFetchResult> {
    const url = this.config.endpoint;
    if (!url) return { phones: [], hasNextPage: false, providerErrors: ['No URL configured'] };

    const context: ParserContext = {
      sourceUrl: url,
      configuredBrands: this.config.brandFilter || [],
      sourceName: this.sourceName,
    };

    const catalogTimeoutMs = Math.max(5000, Math.min(12000, Number(this.config.timeoutMs || 30000)));
    const response = await this.fetchWithTimeout(
      url,
      { headers: { Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8' } },
      catalogTimeoutMs,
    );
    if (!response.ok) return { phones: [], hasNextPage: false, providerErrors: [`Catalog page returned HTTP ${response.status}`] };

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('json')) return this.fetchJsonResponse(response);

    const html = await this.readTextLimited(response);
    const parser = getManufacturerParser(url);
    const phones: NormalizedPhone[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    let skippedCount = 0;
    const discoveredAll = parser.discover(html, context);
    const discovered = discoveredAll.filter(candidate => {
      if (!isNonProductAsset(candidate.url)) return true;
      skippedCount += 1;
      warnings.push(`Skipped non-product asset: ${candidate.url}`);
      return false;
    });

    // Catalog/listing/navigation pages are discovery surfaces only. They must
    // never become Phone records, even when their HTML contains generic JSON-LD.
    const sourcePageClassification = classifyCollectorPage({ url, html, sourceName: this.sourceName });
    if (sourcePageClassification.kind === 'product') {
      const catalogPhone = normalizePhone(parser.parseProduct(html, url, context), this.generateSlug.bind(this));
      if (catalogPhone && discovered.length === 0) phones.push(catalogPhone);
    } else if (sourcePageClassification.kind !== 'unknown') {
      warnings.push(`Source page classified as ${sourcePageClassification.kind}; used for link discovery only.`);
    }

    // Process a bounded slice per invocation. This keeps Vercel/GitHub serverless
    // requests under their execution limits and lets the job runner resume on
    // the next page instead of leaving jobs stuck in `running` forever.
    const pageSize = Math.max(1, Math.min(8, Number(this.config.maxProductPages || process.env.COLLECTOR_PRODUCT_PAGE_LIMIT || 6)));
    const pageNumber = Math.max(1, Number(page || 1));
    const sliceStart = (pageNumber - 1) * pageSize;
    const candidates = discovered.slice(sliceStart, sliceStart + pageSize);
    const hasNextPage = sliceStart + pageSize < discovered.length;
    const productTimeoutMs = Math.max(4000, Math.min(8000, Number(this.config.timeoutMs || 30000)));
    const concurrency = Math.max(1, Math.min(4, Number(process.env.COLLECTOR_PRODUCT_CONCURRENCY || 3)));
    const deadline = Date.now() + Math.max(12000, Math.min(35000, Number(process.env.COLLECTOR_PROVIDER_BUDGET_MS || 30000)));

    const processCandidate = async (candidate: (typeof candidates)[number]): Promise<NormalizedPhone | null> => {
      if (Date.now() >= deadline) {
        warnings.push('Collector time budget reached; remaining product pages will continue on the next run.');
        return null;
      }
      try {
        const productResponse = await this.fetchWithTimeout(
          candidate.url,
          { headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' } },
          productTimeoutMs,
        );
        if (!productResponse.ok) {
          errors.push(`${candidate.url}: HTTP ${productResponse.status}`);
          return null;
        }
        const productHtml = await this.readTextLimited(productResponse);
        const classification = classifyCollectorPage({ url: candidate.url, html: productHtml, title: candidate.label, sourceName: this.sourceName });
        if (classification.kind !== 'product') {
          skippedCount += 1;
          warnings.push(`${candidate.url}: rejected as ${classification.kind} (${classification.reasons.join('; ')})`);
          return null;
        }
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
        if (parsed) parsed.model = normalizeCollectedModelName(parsed.brandName, parsed.model);
        const phone = parsed ? normalizePhone(parsed, this.generateSlug.bind(this)) : null;
        if (!phone) warnings.push(`${candidate.url}: product identity could not be confirmed`);
        return phone;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'request failed';
        if (/Source URL blocked: Domain not in allowed list/i.test(message) && isNonProductAsset(candidate.url)) {
          skippedCount += 1;
          warnings.push(`Skipped external asset outside allowed domains: ${candidate.url}`);
        } else {
          errors.push(`${candidate.url}: ${message}`);
        }
        return null;
      }
    };

    for (let index = 0; index < candidates.length; index += concurrency) {
      if (Date.now() >= deadline) break;
      const batch = await Promise.all(candidates.slice(index, index + concurrency).map(processCandidate));
      for (const phone of batch) if (phone) phones.push(phone);
    }

    const unique = new Map<string, NormalizedPhone>();
    for (const phone of phones) unique.set(`${phone.brandName}|${phone.model}`.toLowerCase(), phone);
    const filtered = this.applyBrandFilter([...unique.values()]);

    if (!filtered.length) {
      const detail = discovered.length
        ? `Discovered ${discovered.length} possible product links, but page ${pageNumber} produced no confirmed phone record.`
        : `No product links or Product JSON-LD were exposed by this page.`;
      return {
        phones: [],
        totalAvailable: discovered.length || undefined,
        hasNextPage,
        providerErrors: [`${detail} Parser: ${parser.id}. Use a JSON/CSV feed or configure a brand-specific parser if the site renders products only in JavaScript.`, ...errors].slice(0, 20),
        providerWarnings: warnings.slice(0, 20),
        skippedCount,
      };
    }

    // Warnings are diagnostics; productive records still proceed to review.
    return {
      phones: filtered,
      totalAvailable: discovered.length || filtered.length,
      hasNextPage,
      providerErrors: errors.slice(0, 20),
      providerWarnings: warnings.slice(0, 20),
      skippedCount,
    };
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
