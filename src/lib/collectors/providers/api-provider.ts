import { BaseProvider, ProviderFetchResult } from './base';
import { NormalizedPhone } from '../types';

export class ApiProvider extends BaseProvider {
  async fetch(page = 1, _pageToken?: string): Promise<ProviderFetchResult> {
    const baseUrl = this.config.endpoint;
    if (!baseUrl) return { phones: [], hasNextPage: false, providerErrors: ['No endpoint configured'] };

    const pageSize = this.config.pagination?.pageSize || 50;
    const pageParam = this.config.pagination?.pageParam || 'page';
    const separator = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${separator}${pageParam}=${page}&limit=${pageSize}`;

    const response = await this.fetchWithTimeout(url);
    if (!response.ok) {
      return { phones: [], hasNextPage: false, providerErrors: [`HTTP ${response.status}`] };
    }

    let data = await response.json();
    if (this.config.dataPath) {
      for (const key of this.config.dataPath.split('.')) { data = data?.[key]; }
    }
    if (!Array.isArray(data)) {
      for (const w of ['phones', 'data', 'results', 'items']) {
        if (Array.isArray(data?.[w])) { data = data[w]; break; }
      }
    }

    const phones: NormalizedPhone[] = (Array.isArray(data) ? data : []).map((raw: any) => {
      const brandName = String(raw.brand || raw.brandName || '').trim();
      const model = String(raw.model || raw.modelName || raw.name || '').trim();
      return {
        brandName, model,
        slug: this.generateSlug(brandName, model),
        releaseDate: String(raw.releaseDate || ''),
        thumbnail: String(raw.thumbnail || raw.image || ''),
        display: { size: String(raw.display || raw.displaySize || ''), resolution: String(raw.resolution || ''), type: String(raw.displayType || ''), refreshRate: String(raw.refreshRate || '') },
        processor: { chipset: String(raw.chipset || ''), cpu: String(raw.cpu || ''), gpu: String(raw.gpu || '') },
        memory: { ram: String(raw.ram || ''), storage: String(raw.storage || '') },
        camera: { rearModules: String(raw.mainCamera || ''), frontCamera: String(raw.selfieCamera || '') },
        battery: { capacity: String(raw.battery || '') },
        body: { weight: String(raw.weight || ''), dimensions: String(raw.dimensions || ''), colors: String(raw.colors || '') },
        software: { os: String(raw.os || ''), osVersion: String(raw.osVersion || ''), osUI: String(raw.osUI || '') },
      };
    }).filter((p: NormalizedPhone) => p.brandName && p.model);

    const totalAvailable = typeof data?.total === 'number' ? data.total : typeof data?.count === 'number' ? data.count : phones.length;
    const maxPages = this.config.pagination?.maxPages || 50;
    const hasNextPage = page < maxPages && phones.length === pageSize;

    return { phones: this.applyBrandFilter(phones), totalAvailable, hasNextPage };
  }
}