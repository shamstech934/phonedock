import { BaseProvider, ProviderFetchResult } from './base';
import { NormalizedPhone } from '../types';

export class JsonUrlProvider extends BaseProvider {
  async fetch(_page?: number, _pageToken?: string): Promise<ProviderFetchResult> {
    const url = this.config.endpoint;
    if (!url) return { phones: [], hasNextPage: false, providerErrors: ['No endpoint configured'] };

    const response = await this.fetchWithTimeout(url);
    if (!response.ok) {
      return { phones: [], hasNextPage: false, providerErrors: [`HTTP ${response.status}: ${response.statusText}`] };
    }

    let data = await response.json();
    // Navigate data path if configured (e.g. "data.phones")
    if (this.config.dataPath) {
      for (const key of this.config.dataPath.split('.')) {
        data = data?.[key];
      }
    }

    if (!Array.isArray(data)) {
      // Try common wrapper keys
      for (const wrapper of ['phones', 'data', 'records', 'results', 'items']) {
        if (Array.isArray(data?.[wrapper])) { data = data[wrapper]; break; }
      }
    }

    if (!Array.isArray(data)) {
      return { phones: [], hasNextPage: false, providerErrors: ['Response is not an array and no wrapper key found'] };
    }

    const phones: NormalizedPhone[] = [];
    const providerErrors: string[] = [];

    for (let i = 0; i < data.length; i++) {
      try {
        const raw = data[i];
        const mapping = this.config.mappingRules || {};
        const get = (field: string) => {
          const mapped = mapping[field] || field;
          return raw[mapped] ?? raw[field];
        };

        const brandName = String(get('brand') || get('brandName') || '').trim();
        const model = String(get('model') || get('modelName') || get('name') || '').trim();
        if (!brandName || !model) { providerErrors.push(`Row ${i}: missing brand or model`); continue; }

        const slug = this.generateSlug(brandName, model);

        phones.push({
          brandName,
          model,
          slug,
          releaseDate: String(get('releaseDate') || ''),
          announcedDate: String(get('announcedDate') || ''),
          availability: String(get('availability') || ''),
          deviceStatus: String(get('status') || get('deviceStatus') || ''),
          deviceType: String(get('deviceType') || ''),
          thumbnail: String(get('thumbnail') || get('image') || ''),
          images: typeof get('images') === 'string' ? get('images').split(',').map((s: string) => s.trim()).filter(Boolean) : Array.isArray(get('images')) ? get('images') : [],
          display: {
            size: String(get('display') || get('displaySize') || ''),
            resolution: String(get('resolution') || ''),
            type: String(get('displayType') || ''),
            refreshRate: String(get('refreshRate') || ''),
            brightness: String(get('brightness') || ''),
            protection: String(get('protection') || ''),
          },
          processor: {
            chipset: String(get('chipset') || ''),
            cpu: String(get('cpu') || ''),
            gpu: String(get('gpu') || ''),
            process: String(get('process') || get('fabrication') || ''),
          },
          memory: {
            ram: String(get('ram') || ''),
            storage: String(get('storage') || ''),
            cardSlot: String(get('cardSlot') || ''),
          },
          camera: {
            rearModules: String(get('mainCamera') || get('rearCamera') || ''),
            frontCamera: String(get('selfieCamera') || get('frontCamera') || ''),
            aperture: String(get('aperture') || ''),
            ois: String(get('ois') || ''),
            videoRecording: String(get('videoRecording') || ''),
          },
          battery: {
            capacity: String(get('battery') || get('batteryCapacity') || ''),
            wiredCharging: String(get('charging') || get('chargingSpeed') || ''),
            wirelessCharging: String(get('wirelessCharge') || ''),
          },
          body: {
            dimensions: String(get('dimensions') || ''),
            weight: String(get('weight') || ''),
            build: String(get('build') || ''),
            waterResistance: String(get('ipRating') || get('waterResistance') || ''),
            colors: String(get('colors') || ''),
            sim: String(get('sim') || ''),
          },
          connectivity: {
            network: String(get('network') || ''),
            fiveG: String(get('5g') || get('fiveG') || ''),
            wifi: String(get('wifi') || ''),
            bluetooth: String(get('bluetooth') || ''),
            nfc: String(get('nfc') || ''),
            usb: String(get('usb') || ''),
          },
          software: {
            os: String(get('os') || ''),
            osVersion: String(get('osVersion') || ''),
            osUI: String(get('osUI') || ''),
            updatePolicy: String(get('updatePolicy') || ''),
          },
        });
      } catch (e: any) {
        providerErrors.push(`Row ${i}: ${e.message}`);
      }
    }

    return { phones: this.applyBrandFilter(phones), hasNextPage: false, providerErrors };
  }
}