import { BaseProvider, ProviderFetchResult } from './base';
import Papa from 'papaparse';

export class CsvUrlProvider extends BaseProvider {
  async fetch(): Promise<ProviderFetchResult> {
    const url = this.config.endpoint;
    if (!url) return { phones: [], hasNextPage: false, providerErrors: ['No endpoint configured'] };

    const response = await this.fetchWithTimeout(url);
    if (!response.ok) {
      return { phones: [], hasNextPage: false, providerErrors: [`HTTP ${response.status}`] };
    }

    const text = await response.text();
    const mapping = this.config.mappingRules || {};

    return new Promise((resolve) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim(),
        complete: (results) => {
          const phones = (results.data as any[]).map(raw => {
            const get = (f: string) => raw[mapping[f] || f] ?? '';
            const brandName = String(get('brand') || get('brandName') || '').trim();
            const model = String(get('model') || get('modelName') || get('name') || '').trim();
            return {
              brandName, model,
              slug: this.generateSlug(brandName, model),
              releaseDate: String(get('releaseDate') || ''),
              thumbnail: String(get('thumbnail') || get('image') || ''),
              display: { size: String(get('display') || ''), resolution: String(get('resolution') || '') },
              processor: { chipset: String(get('chipset') || '') },
              memory: { ram: String(get('ram') || ''), storage: String(get('storage') || '') },
              camera: { rearModules: String(get('mainCamera') || '') },
              battery: { capacity: String(get('battery') || '') },
              body: { weight: String(get('weight') || ''), colors: String(get('colors') || '') },
              software: { os: String(get('os') || '') },
            };
          }).filter((p: any) => p.brandName && p.model);

          const providerErrors = results.errors.map(e => `Row ${e.row}: ${e.message}`).slice(0, 50);
          resolve({ phones: this.applyBrandFilter(phones), hasNextPage: false, providerErrors });
        },
        error: (err: Error) => {
          resolve({ phones: [], hasNextPage: false, providerErrors: [err.message] });
        },
      });
    });
  }
}