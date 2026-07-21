import { NormalizedPhone, ProviderConfig, FieldProvenance } from '../types';
import { validateUrlForFetch } from '@/lib/ssrf-guard';

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
    const validation = await validateUrlForFetch(url, this.config.allowedDomains || []);
    if (!validation.safe) throw new Error(`Source URL blocked: ${validation.reason}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'PhoneDock-Collector/1.0',
        'Accept': 'application/json',
        ...this.config.headers,
        ...(options.headers as Record<string, string> || {}),
      };
      // Inject API key from env if configured
      if (this.config.apiKeyEnvVar && process.env[this.config.apiKeyEnvVar]) {
        const key = process.env[this.config.apiKeyEnvVar]!;
        const headerStyle = this.config.apiKeyHeader || 'Authorization';
        if (headerStyle === 'x-api-key') {
          headers['x-api-key'] = key;
        } else {
          headers['Authorization'] = `Bearer ${key}`;
        }
      }
      const response = await fetch(url, { ...options, headers, signal: controller.signal, redirect: 'error' });
      const declaredLength = Number(response.headers.get('content-length') || 0);
      if (declaredLength > (this.config.maxResponseBytes || 5 * 1024 * 1024)) throw new Error('Source response exceeds the configured size limit');
      return response;
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
