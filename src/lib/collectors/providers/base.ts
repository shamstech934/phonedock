import { NormalizedPhone, ProviderConfig, FieldProvenance } from '../types';
import { validateUrlForFetch } from '@/lib/ssrf-guard';

function normalizeHeaderRecord(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!value) return result;

  const append = (key: unknown, rawValue: unknown): void => {
    if (typeof key !== 'string' || !key.trim()) return;
    if (typeof rawValue !== 'string' && typeof rawValue !== 'number' && typeof rawValue !== 'boolean') return;
    const normalized = String(rawValue).trim();
    if (!normalized || /[\r\n]/.test(normalized)) return;
    result[key] = normalized;
  };

  if (value instanceof Headers) {
    value.forEach((headerValue, key) => append(key, headerValue));
    return result;
  }

  if (value instanceof Map) {
    value.forEach((headerValue, key) => append(key, headerValue));
    return result;
  }

  const candidate = value as { entries?: () => IterableIterator<[unknown, unknown]>; toObject?: () => unknown };
  if (typeof candidate.entries === 'function') {
    try {
      for (const [key, headerValue] of candidate.entries()) append(key, headerValue);
      return result;
    } catch { /* fall through */ }
  }
  if (typeof candidate.toObject === 'function') {
    try { return normalizeHeaderRecord(candidate.toObject()); } catch { /* fall through */ }
  }

  if (typeof value === 'object') {
    for (const [key, headerValue] of Object.entries(value as Record<string, unknown>)) append(key, headerValue);
  }
  return result;
}

export interface ProviderFetchResult {
  phones: NormalizedPhone[];
  totalAvailable?: number;
  hasNextPage: boolean;
  nextPageToken?: string;
  providerErrors: string[];
}

export interface ProviderTestResult {
  success: boolean;
  message: string;
  sampleCount?: number;
  latencyMs?: number;
}

export abstract class BaseProvider {
  protected config: ProviderConfig;
  protected sourceId: string;
  protected sourceName: string;

  constructor(config: ProviderConfig, sourceId: string, sourceName: string) {
    this.config = config;
    this.sourceId = sourceId;
    this.sourceName = sourceName;
  }

  abstract fetch(page?: number, pageToken?: string): Promise<ProviderFetchResult>;

  async test(): Promise<ProviderTestResult> {
    try {
      const start = Date.now();
      const result = await this.fetch(1);
      return {
        success: result.providerErrors.length === 0,
        message: result.providerErrors.length > 0
          ? `Warnings: ${result.providerErrors.join('; ')}`
          : `Connected. Found ${result.phones.length} records.`,
        sampleCount: result.phones.length,
        latencyMs: Date.now() - start,
      };
    } catch (e: unknown) {
      return { success: false, message: e instanceof Error ? e.message : 'Connection failed' };
    }
  }

  protected buildProvenance(field: string, value: unknown, confidence: number = 0.8): FieldProvenance {
    return {
      field,
      value,
      sourceName: this.sourceName,
      sourceUrl: this.config.endpoint || '',
      collectedAt: new Date().toISOString(),
      providerId: this.sourceId,
      confidence,
    };
  }

  protected applyBrandFilter(phones: NormalizedPhone[]): NormalizedPhone[] {
    if (!this.config.brandFilter || this.config.brandFilter.length === 0) return phones;
    const filters = this.config.brandFilter.map(b => b.toLowerCase());
    return phones.filter(p => filters.some(f => p.brandName.toLowerCase().includes(f)));
  }

  protected generateSlug(brand: string, model: string): string {
    return `${brand} ${model}`
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  protected async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // Build a real Headers instance from primitive string values only. This is
      // intentionally stricter than passing a Mongoose Map/plain object directly
      // to fetch, because Node's undici otherwise stringifies entire documents as
      // a header value and throws `Headers.append ... is an invalid header value`.
      const safeHeaderRecord: Record<string, string> = {
        'User-Agent': 'SpecsDekh-Collector/2.0 (+https://specsdekh.com)',
        Accept: 'application/json',
        ...normalizeHeaderRecord(this.config.headers),
        ...normalizeHeaderRecord(options.headers),
      };
      if (this.config.apiKeyEnvVar) {
        const key = process.env[this.config.apiKeyEnvVar];
        if (!key) throw new Error(`Required secret ${this.config.apiKeyEnvVar} is not configured`);
        const headerStyle = this.config.apiKeyHeader || 'Authorization';
        safeHeaderRecord[headerStyle] = headerStyle.toLowerCase() === 'authorization' ? `Bearer ${key}` : key;
      }
      const requestHeaders = new Headers();
      for (const [key, value] of Object.entries(safeHeaderRecord)) {
        if (!key.trim() || !value.trim() || /[\r\n]/.test(key) || /[\r\n]/.test(value)) continue;
        requestHeaders.set(key, value);
      }

      let currentUrl = url;
      for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
        const validation = await validateUrlForFetch(currentUrl, this.config.allowedDomains || []);
        if (!validation.safe) throw new Error(`Source URL blocked: ${validation.reason}`);
        const { headers: _ignoredHeaders, signal: _ignoredSignal, redirect: _ignoredRedirect, ...safeOptions } = options;
        const response = await fetch(currentUrl, { ...safeOptions, headers: requestHeaders, signal: controller.signal, redirect: 'manual' });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location) throw new Error(`Source returned HTTP ${response.status} without a redirect location`);
          if (redirectCount >= 3) throw new Error('Source redirected too many times');
          currentUrl = new URL(location, currentUrl).toString();
          continue;
        }
        const declaredLength = Number(response.headers.get('content-length') || 0);
        if (declaredLength > (this.config.maxResponseBytes || 5 * 1024 * 1024)) throw new Error('Source response exceeds the configured size limit');
        return response;
      }
      throw new Error('Source redirected too many times');
    } finally {
      clearTimeout(timer);
    }
  }

  protected async readTextLimited(response: Response): Promise<string> {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > (this.config.maxResponseBytes || 5 * 1024 * 1024)) throw new Error('Source response exceeds the configured size limit');
    return text;
  }
}
