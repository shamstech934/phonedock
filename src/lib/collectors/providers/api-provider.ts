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

    let root: any;
    try {
      root = await response.json();
    } catch {
      return { phones: [], hasNextPage: false, providerErrors: ['Invalid JSON response from source'] };
    }

    // Extract total from root BEFORE data-path extraction
    let totalAvailable = 0;
    if (typeof root?.total === 'number') totalAvailable = root.total;
    else if (typeof root?.count === 'number') totalAvailable = root.count;

    let data = root;
    if (this.config.dataPath) {
      for (const key of this.config.dataPath.split('.')) { data = data?.[key]; }
    }
    if (!Array.isArray(data)) {
      for (const w of ['phones', 'data', 'results', 'items']) {
        if (Array.isArray(data?.[w])) { data = data[w]; break; }
      }
    }

    // Apply mapping rules
    const mapping = this.config.mappingRules || {};

    const phones: NormalizedPhone[] = (Array.isArray(data) ? data : []).map((raw: any) => {
      const get = (field: string) => {
        const mapped = mapping[field] || field;
        return raw[mapped] ?? raw[field];
      };
      const brandName = String(get('brand') || get('brandName') || '').trim();
      const model = String(get('model') || get('modelName') || get('name') || '').trim();
      return {
        brandName, model,
        slug: this.generateSlug(brandName, model),
        releaseDate: String(get('releaseDate') || ''),
        announcedDate: String(get('announcedDate') || ''),
        thumbnail: String(get('thumbnail') || get('image') || ''),
        images: typeof get('images') === 'string' ? get('images').split(',').map((s: string) => s.trim()).filter(Boolean) : Array.isArray(get('images')) ? get('images') : [],
        display: { size: String(get('display') || get('displaySize') || ''), resolution: String(get('resolution') || ''), type: String(get('displayType') || ''), refreshRate: String(get('refreshRate') || ''), brightness: String(get('brightness') || ''), protection: String(get('protection') || '') },
        processor: { chipset: String(get('chipset') || ''), cpu: String(get('cpu') || ''), gpu: String(get('gpu') || ''), process: String(get('process') || get('fabrication') || '') },
        memory: { ram: String(get('ram') || ''), ramType: String(get('ramType') || ''), storage: String(get('storage') || ''), storageType: String(get('storageType') || ''), cardSlot: String(get('cardSlot') || '') },
        camera: { rearModules: String(get('mainCamera') || get('rearCamera') || ''), frontCamera: String(get('selfieCamera') || get('frontCamera') || ''), aperture: String(get('aperture') || ''), ois: String(get('ois') || ''), eis: String(get('eis') || ''), zoom: String(get('zoom') || ''), videoRecording: String(get('videoRecording') || ''), cameraFeatures: String(get('cameraFeatures') || '') },
        battery: { capacity: String(get('battery') || get('batteryCapacity') || ''), type: String(get('batteryType') || ''), wiredCharging: String(get('charging') || get('chargingSpeed') || ''), wirelessCharging: String(get('wirelessCharge') || ''), reverseCharging: String(get('reverseCharging') || '') },
        body: { dimensions: String(get('dimensions') || ''), weight: String(get('weight') || ''), build: String(get('build') || ''), waterResistance: String(get('ipRating') || get('waterResistance') || ''), colors: String(get('colors') || ''), sim: String(get('sim') || '') },
        connectivity: { network: String(get('network') || ''), fiveG: String(get('5g') || get('fiveG') || ''), wifi: String(get('wifi') || ''), bluetooth: String(get('bluetooth') || ''), nfc: String(get('nfc') || ''), usb: String(get('usb') || ''), gps: String(get('gps') || ''), infrared: String(get('infrared') || '') },
        software: { os: String(get('os') || ''), osVersion: String(get('osVersion') || ''), osUI: String(get('osUI') || ''), updatePolicy: String(get('updatePolicy') || '') },
        audio: { speakers: String(get('speakers') || ''), headphoneJack: String(get('headphoneJack') || '') },
        sensors: { fingerprint: String(get('fingerprint') || ''), others: String(get('sensors') || '') },
      };
    }).filter((p: NormalizedPhone) => p.brandName && p.model);

    const maxPages = this.config.pagination?.maxPages || 50;
    const hasNextPage = page < maxPages && phones.length === pageSize;

    return { phones: this.applyBrandFilter(phones), totalAvailable, hasNextPage, providerErrors: [] };
  }
}