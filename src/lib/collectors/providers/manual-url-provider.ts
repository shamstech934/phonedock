import { BaseProvider, ProviderFetchResult } from './base';

export class ManualUrlProvider extends BaseProvider {
  async fetch(): Promise<ProviderFetchResult> {
    const url = this.config.endpoint;
    if (!url) return { phones: [], hasNextPage: false, providerErrors: ['No URL configured'] };

    const response = await this.fetchWithTimeout(url);
    if (!response.ok) {
      return { phones: [], hasNextPage: false, providerErrors: [`HTTP ${response.status}`] };
    }

    let data: any;
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
    const phones: any[] = [];
    const tryExtract = (obj: any, depth = 0): void => {
      if (depth > 5) return;
      if (Array.isArray(obj)) { obj.forEach(item => tryExtract(item, depth + 1)); return; }
      if (typeof obj !== 'object' || !obj) return;
      // Heuristic: if it has brand + model/name, treat as phone
      const brand = obj.brand || obj.brandName || obj.manufacturer;
      const model = obj.model || obj.modelName || obj.name || obj.title;
      if (brand && model) { phones.push(obj); return; }
      for (const val of Object.values(obj)) { tryExtract(val, depth + 1); }
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
    }).filter((p: any) => p.brandName && p.model);

    return { phones: this.applyBrandFilter(normalized), hasNextPage: false, providerErrors: [] };
  }
}