import { BaseProvider, ProviderFetchResult } from './base';
import type { NormalizedPhone } from '../types';

export class ManualUrlProvider extends BaseProvider {
  async fetch(): Promise<ProviderFetchResult> {
    const url = this.config.endpoint;
    if (!url) return { phones: [], hasNextPage: false, providerErrors: ['No URL configured'] };

    const response = await this.fetchWithTimeout(url);
    if (!response.ok) {
      return { phones: [], hasNextPage: false, providerErrors: [`HTTP ${response.status}`] };
    }

    let data: unknown;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('json')) {
      try {
        data = await response.json();
      } catch {
        return { phones: [], hasNextPage: false, providerErrors: ['Invalid JSON response from source'] };
      }
    } else {
      return { phones: [], hasNextPage: false, providerErrors: ['Only JSON responses supported for manual URLs'] };
    }

    // Try to extract phone-like data from any JSON structure
    const phones: Record<string, unknown>[] = [];
    const tryExtract = (obj: unknown, depth = 0): void => {
      if (depth > 5 || obj == null || typeof obj !== 'object') return;
      if (Array.isArray(obj)) { obj.forEach(item => tryExtract(item, depth + 1)); return; }
      const record = obj as Record<string, unknown>;
      // Heuristic: if it has brand + model/name, treat as phone
      const brand = record.brand || record.brandName || record.manufacturer;
      const model = record.model || record.modelName || record.name || record.title;
      if (brand && model) { phones.push(record); return; }
      for (const val of Object.values(record)) { tryExtract(val, depth + 1); }
    };
    tryExtract(data);

    if (phones.length === 0) {
      return { phones: [], hasNextPage: false, providerErrors: ['No phone-like records found in response'] };
    }

    const normalized = phones.map(raw => {
      const brandName = String(raw.brand || raw.brandName || raw.manufacturer || '').trim();
      const model = String(raw.model || raw.modelName || raw.name || raw.title || '').trim();
      return {
        brandName, model,
        slug: this.generateSlug(brandName, model),
        thumbnail: String(raw.thumbnail || raw.image || raw.imageUrl || ''),
        display: { size: String(raw.display || raw.displaySize || '') },
        processor: { chipset: String(raw.chipset || '') },
        memory: { ram: String(raw.ram || ''), storage: String(raw.storage || '') },
        battery: { capacity: String(raw.battery || '') },
        body: { weight: String(raw.weight || '') },
        software: { os: String(raw.os || '') },
      };
    }).filter((p: NormalizedPhone) => p.brandName && p.model);

    return { phones: this.applyBrandFilter(normalized), hasNextPage: false, providerErrors: [] };
  }
}