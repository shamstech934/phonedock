import type { NormalizedPhone, ProviderConfig } from './types';

export function getNestedValue(record: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, record);
}

const text = (value: unknown) => value == null ? '' : String(value).trim();
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
const number = (value: unknown): number | undefined => { const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(parsed) && value !== '' ? parsed : undefined; };
const bool = (value: unknown): boolean | null => { const v = text(value).toLowerCase(); return ['true', 'yes', '1', 'approved'].includes(v) ? true : ['false', 'no', '0', 'unapproved'].includes(v) ? false : null; };

export function mapExternalRecord(record: Record<string, unknown>, config: ProviderConfig): NormalizedPhone {
  const mapping = config.mappingRules || {}; const defaults = config.defaultValues || {};
  const get = (...fields: string[]) => { for (const field of fields) { const value = getNestedValue(record, mapping[field] || field) ?? defaults[field]; if (value !== undefined && value !== null && value !== '') return value; } };
  const brandName = text(get('brand', 'brandName', 'manufacturer')); const model = text(get('model', 'modelName', 'name', 'title'));
  const rawImages = get('images'); const images = Array.isArray(rawImages) ? rawImages.map(text).filter(Boolean) : text(rawImages).split(',').map(v => v.trim()).filter(Boolean);
  return {
    brandName, model, slug: text(get('slug')) || slugify(`${brandName} ${model}`), releaseDate: text(get('releaseDate')), announcedDate: text(get('announcedDate')),
    availability: text(get('availability')), deviceStatus: text(get('deviceStatus', 'status')), deviceType: text(get('deviceType')), thumbnail: text(get('thumbnail', 'image')), images,
    pakistanPrice: number(get('pakistanPrice', 'pricePKR')), ptaApproved: bool(get('ptaApproved')), ptaStatus: text(get('ptaStatus')),
    display: { size: text(get('display', 'displaySize')), type: text(get('displayType')), resolution: text(get('resolution')), refreshRate: text(get('refreshRate')) },
    processor: { chipset: text(get('chipset')), cpu: text(get('cpu')), gpu: text(get('gpu')) }, memory: { ram: text(get('ram')), storage: text(get('storage')), ramType: text(get('ramType')), storageType: text(get('storageType')) },
    camera: { rearModules: text(get('rearCamera', 'mainCamera')), frontCamera: text(get('frontCamera', 'selfieCamera')) }, battery: { capacity: text(get('battery', 'batteryCapacity')), wiredCharging: text(get('charging', 'chargingSpeed')) },
    body: { dimensions: text(get('dimensions')), weight: text(get('weight')), colors: text(get('colors')), sim: text(get('sim')), waterResistance: text(get('ipRating')) },
    connectivity: { network: text(get('network')), fiveG: text(get('fiveG', '5g')), wifi: text(get('wifi')), bluetooth: text(get('bluetooth')), nfc: text(get('nfc')) }, software: { os: text(get('os')), osVersion: text(get('osVersion')), osUI: text(get('osUI')) },
  };
}
