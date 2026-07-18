/**
 * Phone record normalization for Import Engine V2.
 * Single shared layer — used by ALL parsers.
 * Maps raw input to NormalizedPhoneImportRecord.
 */

// ── Types ──────────────────────────────────────────────────────────

export interface NormalizedPhoneImportRecord {
  originalRowNumber: number;
  originalRecord: Record<string, unknown>;
  normalizedData: NormalizedPhoneData;
  warnings: string[];
  errors: ImportErrorItem[];
  duplicateKey: string;
}

export interface NormalizedPhoneData {
  // Core
  brand: string;
  model: string;
  slug: string;
  pricePKR: number | null;
  releaseDate: string | null;
  ptaStatus: string;
  ptaApproved: boolean;
  featured: boolean;
  trending: boolean;
  upcoming: boolean;
  thumbnail: string;
  description: string;
  // Specs (mapped to PhoneSpecs)
  specs: Record<string, string>;
  // Benchmarks
  benchmarks: Record<string, number | null>;
  // Images
  images: string[];
  // Extra fields for unknown columns
  extra: Record<string, unknown>;
}

export interface ImportErrorItem {
  rowNumber: number;
  field?: string;
  originalValue?: string;
  errorCode: string;
  errorMessage: string;
  brand?: string;
  model?: string;
}

// ── Constants ──────────────────────────────────────────────────────

const MAX_STRING_LENGTH = 500;
const MAX_NESTED_DEPTH = 3;
const MAX_ARRAY_LENGTH = 200;
const MAX_RECORDS = 50000;

// All spec fields that map to PhoneSpecs
export const SPEC_FIELDS = new Set([
  'display','displayType','resolution','refreshRate','protection','brightness',
  'chipset','cpu','gpu','process','ram','ramType','storage','cardSlot',
  'mainCamera','mainCameraSensor','aperture','ois','eis','ultrawide','telephoto','zoom','cameraFeatures','videoRecording',
  'selfieCamera','selfieSensor','selfieVideo',
  'battery','charging','chargingSpeed','wirelessCharge','wirelessSpeed','reverseCharge',
  'weight','dimensions','build','sim','ipRating','network','fiveG','wifi','bluetooth','nfc','usb','infrared',
  'fingerprint','faceUnlock','sensors','colors',
  'os','osVersion','osUI','updatePolicy','specialFeatures',
]);

export const BENCHMARK_FIELDS = new Set([
  'antutu','geekbenchSingle','geekbenchMulti','gamingScore',
  'pubgFps','codMobileFps','genshinFps','videoPlayback','gamingBattery','browsingBattery',
]);

// Phone-level fields
const PHONE_FIELDS = new Set([
  'brand','model','modelName','slug','pricePKR','price','releaseDate',
  'ptaStatus','ptaApproved','featured','trending','upcoming',
  'thumbnail','image','images','description',
  'cameraScore','performanceScore','batteryScore','displayScore','valueScore','overallRating',
  'seoTitle','seoDescription','keywords','pros','cons','reviewSummary','reviewVerdict',
]);

// Aliases: map various input column names to canonical names
const FIELD_ALIASES: Record<string, string> = {
  // Brand
  'brandname': 'brand', 'brand_name': 'brand', 'make': 'brand', 'manufacturer': 'brand',
  // Model
  'modelname': 'model', 'model_name': 'model', 'phone': 'model', 'device': 'model',
  'name': 'model', 'product': 'model', 'title': 'model',
  // Price
  'pricepkr': 'pricePKR', 'price_pkr': 'pricePKR', 'priceinr': 'pricePKR',
  'price': 'pricePKR', 'cost': 'pricePKR', 'costpkr': 'pricePKR',
  // PTA
  'ptastatus': 'ptaStatus', 'pta_status': 'ptaStatus', 'pta': 'ptaStatus',
  'ptaapproved': 'ptaApproved', 'pta_approved': 'ptaApproved',
  // Display
  'displaysize': 'display', 'display_size': 'display', 'screensize': 'display',
  'screentype': 'displayType', 'display_type': 'displayType', 'screentype': 'displayType',
  'resolution': 'resolution', 'screenresolution': 'resolution',
  'refreshrate': 'refreshRate', 'refresh_rate': 'refreshRate',
  'protection': 'protection',
  'brightness': 'brightness',
  // Performance
  'chipset': 'chipset', 'processor': 'chipset', 'soc': 'chipset',
  'cpu': 'cpu', 'processor_cpu': 'cpu',
  'gpu': 'gpu',
  'process': 'process', 'fab': 'process',
  'ram': 'ram', 'memory': 'ram', 'ramsize': 'ram',
  'ramtype': 'ramType', 'ram_type': 'ramType', 'memorytype': 'ramType',
  'storage': 'storage', 'memorysize': 'storage', 'storagesize': 'storage',
  'cardslot': 'cardSlot', 'card_slot': 'cardSlot', 'microsd': 'cardSlot',
  // Camera
  'maincamera': 'mainCamera', 'main_camera': 'mainCamera', 'rearcamera': 'mainCamera',
  'rearcamera': 'mainCamera', 'backcamera': 'mainCamera',
  'maincameramp': 'mainCameraMP', 'main_camera_mp': 'mainCameraMP',
  'maincamerasensor': 'mainCameraSensor', 'camera_sensor': 'mainCameraSensor',
  'selfiecamera': 'selfieCamera', 'frontcamera': 'selfieCamera',
  'selfiecameramp': 'selfieCameraMP', 'front_camera_mp': 'selfieCameraMP',
  'selfiesensor': 'selfieSensor', 'front_sensor': 'selfieSensor',
  'aperture': 'aperture', 'fstop': 'aperture',
  'ois': 'ois', 'imagestabilization': 'ois', 'opticalimagestabilization': 'ois',
  'eis': 'eis', 'electronicimagestabilization': 'eis',
  'ultrawide': 'ultrawide', 'ultra_wide': 'ultrawide', 'ultrawidecamera': 'ultrawide',
  'telephoto': 'telephoto', 'tele_camera': 'telephoto',
  'zoom': 'zoom', 'opticalzoom': 'zoom',
  'camerafeatures': 'cameraFeatures', 'camera_features': 'cameraFeatures',
  'videorecording': 'videoRecording', 'video': 'videoRecording', 'video_recording': 'videoRecording',
  // Battery
  'battery': 'battery', 'batterycapacity': 'battery', 'batterysize': 'battery',
  'batterymah': 'battery', 'battery_mah': 'battery',
  'charging': 'charging', 'chargingtype': 'charging',
  'chargingspeed': 'chargingSpeed', 'charging_speed': 'chargingSpeed', 'fastcharging': 'chargingSpeed',
  'wirelesscharge': 'wirelessCharge', 'wireless_charging': 'wirelessCharge',
  'wirelessspeed': 'wirelessSpeed', 'wireless_speed': 'wirelessSpeed',
  'reversecharge': 'reverseCharge', 'reverse_charging': 'reverseCharge',
  // Body
  'weight': 'weight', 'weightg': 'weight', 'weightingrams': 'weight',
  'dimensions': 'dimensions',
  'build': 'build', 'buildmaterial': 'build',
  'sim': 'sim', 'simtype': 'sim',
  'iprating': 'ipRating', 'ip_rating': 'ipRating', 'waterresistance': 'ipRating',
  'colors': 'colors', 'colour': 'colors', 'availablecolors': 'colors',
  // Connectivity
  'network': 'network', 'networktype': 'network',
  '5g': 'fiveG', '5g': 'fiveG', 'fiveg': 'fiveG', 'has5g': 'fiveG',
  'wifi': 'wifi', 'wifistandard': 'wifi',
  'bluetooth': 'bluetooth', 'bt': 'bluetooth', 'bluetoothversion': 'bluetooth',
  'nfc': 'nfc', 'hasnfc': 'nfc',
  'usb': 'usb', 'usbtype': 'usb', 'usbport': 'usb',
  'infrared': 'infrared', 'ir': 'infrared', 'irblaster': 'infrared',
  // Sensors
  'fingerprint': 'fingerprint', 'fingerprintscanner': 'fingerprint',
  'faceunlock': 'faceUnlock', 'faceid': 'faceUnlock', 'facedetection': 'faceUnlock',
  'sensors': 'sensors',
  // Software
  'os': 'os', 'operatingsystem': 'os',
  'osversion': 'osVersion', 'os_version': 'osVersion',
  'osui': 'osUI', 'os_ui': 'osUI', 'userinterface': 'osUI',
  'updatepolicy': 'updatePolicy', 'os_updates': 'updatePolicy',
  'specialfeatures': 'specialFeatures',
  // Misc
  'releasedate': 'releaseDate', 'launch_date': 'releaseDate', 'launchdate': 'releaseDate',
  'featured': 'featured',
  'trending': 'trending',
  'upcoming': 'upcoming',
  'thumbnail': 'thumbnail', 'image': 'thumbnail', 'imageurl': 'thumbnail',
  'description': 'description', 'desc': 'description',
  'images': 'images', 'photos': 'images', 'imageurls': 'images',
};

// ── Helpers ─────────────────────────────────────────────────────────

function isValidValue(val: unknown, maxLen = MAX_STRING_LENGTH): boolean {
  if (val == null) return false;
  if (typeof val === 'string') return val.trim().length > 0 && val.length <= maxLen;
  if (typeof val === 'number') return isFinite(val);
  if (typeof val === 'boolean') return true;
  if (Array.isArray(val)) return val.length > 0 && val.length <= MAX_ARRAY_LENGTH;
  return false;
}

function cleanString(val: unknown, maxLen = MAX_STRING_LENGTH): string {
  if (val == null) return '';
  if (typeof val === 'number') return isFinite(val) ? String(val) : '';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') {
    if (Array.isArray(val)) return val.map(v => cleanString(v, 50)).filter(Boolean).join(', ');
    try { return String(val); } catch { return ''; }
  }
  const s = String(val).trim();
  return s.length <= maxLen ? s : s.substring(0, maxLen);
}

function toNumber(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === 'number') return isFinite(val) ? val : null;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[,\s₨$₹¥€£]/g, '').trim();
    const n = Number(cleaned);
    return isFinite(n) && n >= 0 ? n : null;
  }
  return null;
}

function normalizeBoolean(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  const s = String(val ?? '').trim().toLowerCase();
  if (['true', 'yes', '1', 'on', 'enabled'].includes(s)) return true;
  return false;
}

function normalizePTAStatus(val: unknown): string {
  const s = String(val ?? '').trim().toLowerCase();
  if (['pta approved', 'approved', 'pta'].includes(s)) return 'PTA Approved';
  if (['non pta', 'non-pta', 'not approved', 'not pta approved'].includes(s)) return 'Non PTA';
  return 'Unknown';
}

function normalizeDate(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  if (!s) return null;

  // Try ISO format
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const date = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmy) {
    const [, a, b, c] = dmy;
    const day = parseInt(a), month = parseInt(b), year = parseInt(c);
    if (year < 100) year += 2000;
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
      return date.toISOString().split('T')[0];
    }
  }

  // Try spreadsheet serial number (e.g., 45678)
  if (/^\d{4,5}$/.test(s)) {
    const epoch = new Date(1899, 11, 30);
    epoch.setDate(epoch.getDate() + parseInt(s));
    if (!isNaN(epoch.getTime()) && epoch.getFullYear() >= 1990 && epoch.getFullYear() <= 2100) {
      return epoch.toISOString().split('T')[0];
    }
  }

  return null;
}

function normalizeRAM(val: unknown): string {
  const s = String(val ?? '').trim();
  if (!s) return '';
  // Normalize "8GB" → "8 GB", "12/256GB" → "12 GB / 256 GB"
  return s;
}

function normalizeStorage(val: unknown): string {
  return normalizeRAM(val);
}

function normalizeRefreshRate(val: unknown): string {
  const s = String(val ?? '').trim().toLowerCase();
  if (!s) return '';
  const m = s.match(/(\d+)\s*hz/i);
  return m ? `${m[1]}Hz` : s;
}

function normalizeChargingSpeed(val: unknown): string {
  const s = String(val ?? '').trim();
  if (!s) return '';
  const m = s.match(/(\d+)\s*w/i);
  return m ? `${m[1]}W` : s;
}

function normalizeWeight(val: unknown): string {
  const s = String(val ?? '').trim();
  if (!s) return '';
  const m = s.match(/([\d.]+)\s*(g|grams?|kg)/i);
  if (m) return m[2].toLowerCase().startsWith('k') ? `${parseFloat(m[1])} kg` : `${m[1]} g`;
  return s;
}

function normalizeBattery(val: unknown): string {
  const s = String(val ?? '').trim();
  if (!s) return '';
  const m = s.match(/(\d+)\s*mah/i);
  return m ? `${m[1]} mAh` : s;
}

function normalizeResolution(val: unknown): string {
  if (!val) return '';
  const s = String(val).trim();
  // Normalize × to 'x', + to 'x'
  return s.replace(/[×+x]/g, 'x').replace(/\s+/g, ' ').trim();
}

function normalizeMP(val: unknown): string {
  if (val == null) return '';
  const n = toNumber(val);
  return n !== null ? `${n}MP` : '';
}

function normalizeImageURL(val: unknown): string {
  const s = cleanString(val, 200);
  if (!s) return '';
  if (s.match(/^https?:\/\//i)) return s;
  if (s.match(/^\/\//)) return s;
  return '';
}

function normalizeImageArray(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.map(v => normalizeImageURL(v)).filter(Boolean);
  }
  const s = cleanString(val, 500);
  if (!s) return [];
  // Comma-separated
  return s.split(',').map(v => normalizeImageURL(v.trim())).filter(Boolean);
}

// Detect prototype pollution attempts
function isSafeObject(val: unknown, depth = 0): boolean {
  if (depth > MAX_NESTED_DEPTH) return false;
  if (val == null || typeof val !== 'object') return true;
  if (Array.isArray(val)) return val.length <= MAX_ARRAY_LENGTH && val.every(v => isSafeObject(v, depth + 1));
  if (val instanceof Date) return true;
  if (val instanceof ObjectId) return true;
  if (val.constructor?.name === 'Object') {
    const keys = Object.keys(val);
    return keys.length <= 200 && !keys.some(k => k === '__proto__' || k === 'constructor' || k === 'prototype');
  }
  return false;
}

// ── Main Normalization ────────────────────────────────────────────────

export function normalizePhoneRecord(
  raw: Record<string, unknown>,
  rowIndex: number,
): NormalizedPhoneImportRecord {
  const errors: ImportErrorItem[] = [];
  const warnings: string[] = [];
  const extra: Record<string, unknown> = {};
  const specs: Record<string, string> = {};
  const benchmarks: Record<string, number | null> = {};
  const data: NormalizedPhoneData = {
    brand: '', model: '', slug: '', pricePKR: null, releaseDate: null,
    ptaStatus: 'Unknown', ptaApproved: false, featured: false, trending: false, upcoming: false,
    thumbnail: '', description: '', specs: {}, benchmarks: {}, images: [], extra: {},
  };

  if (!isSafeObject(raw)) {
    errors.push({ rowNumber: rowIndex, errorCode: 'UNSAFE_RECORD', errorMessage: 'Record contains unsafe data structure' });
    return { originalRowNumber: rowIndex, originalRecord: raw, normalizedData: data, warnings, errors, duplicateKey: '' };
  }

  // Process each field
  for (const [key, val] of Object.entries(raw)) {
    const canon = FIELD_ALIASES[key.toLowerCase().replace(/[\s_-]/g, '')] || key;

    if (canon === 'brand') {
      data.brand = cleanString(val, 100);
      if (!data.brand) errors.push({ rowNumber: rowIndex, field: key, originalValue: String(val ?? ''), errorCode: 'MISSING_BRAND', errorMessage: 'Brand is required' });
    } else if (canon === 'model') {
      data.model = cleanString(val, 200);
      if (!data.model) errors.push({ rowNumber: rowIndex, field: key, originalValue: String(val ?? ''), errorCode: 'MISSING_MODEL', errorMessage: 'Model is required' });
    } else if (canon === 'pricePKR') {
      const n = toNumber(val);
      if (n === null && isValidValue(val)) {
        errors.push({ rowNumber: rowIndex, field: key, originalValue: String(val ?? ''), errorCode: 'INVALID_PRICE', errorMessage: `Invalid price: ${val}` });
      } else {
        data.pricePKR = n;
      }
    } else if (canon === 'releaseDate') {
      const d = normalizeDate(val);
      if (d === null && isValidValue(val)) {
        warnings.push(`${key}: Could not parse date "${val}"`);
      }
      data.releaseDate = d;
    } else if (canon === 'ptaStatus') {
      data.ptaStatus = normalizePTAStatus(val);
    } else if (canon === 'ptaApproved') {
      data.ptaApproved = normalizeBoolean(val);
    } else if (canon === 'featured') {
      data.featured = normalizeBoolean(val);
    } else if (canon === 'trending') {
      data.trending = normalizeBoolean(val);
    } else if (canon === 'upcoming') {
      data.upcoming = normalizeBoolean(val);
    } else if (canon === 'thumbnail') {
      data.thumbnail = normalizeImageURL(val);
    } else if (canon === 'images') {
      data.images = normalizeImageArray(val);
    } else if (canon === 'description') {
      data.description = cleanString(val, 2000);
    } else if (canon === 'ram') {
      data.specs.ram = normalizeRAM(val);
    } else if (canon === 'storage') {
      data.specs.storage = normalizeStorage(val);
    } else if (canon === 'display') {
      data.specs.display = cleanString(val, 100);
    } else if (canon === 'refreshRate') {
      data.specs.refreshRate = normalizeRefreshRate(val);
    } else if (canon === 'resolution') {
      data.specs.resolution = normalizeResolution(val);
    } else if (canon === 'mainCamera') {
      data.specs.mainCamera = cleanString(val, 300);
    } else if (canon === 'selfieCamera') {
      data.specs.selfieCamera = cleanString(val, 300);
    } else if (canon === 'battery') {
      data.specs.battery = normalizeBattery(val);
    } else if (canon === 'chargingSpeed') {
      data.specs.chargingSpeed = normalizeChargingSpeed(val);
    } else if (canon === 'weight') {
      data.specs.weight = normalizeWeight(val);
    } else if (canon === 'chipset') {
      data.specs.chipset = cleanString(val, 200);
    } else if (canon === 'cpu') {
      data.specs.cpu = cleanString(val, 200);
    } else if (canon === 'gpu') {
      data.specs.gpu = cleanString(val, 200);
    } else if (canon === 'os') {
      data.specs.os = cleanString(val, 100);
    } else if (SPEC_FIELDS.has(canon)) {
      const s = cleanString(val);
      if (s) data.specs[canon] = s;
    } else if (canon === 'mainCameraMP') {
      data.specs.mainCameraMP = normalizeMP(val);
    } else if (BENCHMARK_FIELDS.has(canon)) {
      benchmarks[canon] = toNumber(val);
    } else if (PHONE_FIELDS.has(canon)) {
      // Skip — already handled above or not in phone core
      if (canon !== 'brand' && canon !== 'model' && canon !== 'pricePKR' && canon !== 'releaseDate'
        && canon !== 'ptaStatus' && canon !== 'ptaApproved' && canon !== 'featured' && canon !== 'trending'
        && canon !== 'upcoming' && canon !== 'thumbnail' && canon !== 'images' && canon !== 'description') {
        // Skip recognized but non-critical phone fields
      }
    } else {
      // Unknown field — store in extra
      if (isValidValue(val, 200)) {
        extra[key] = typeof val === 'string' ? val : (typeof val === 'object' ? JSON.stringify(val) : String(val));
      }
    }
  }

  // Generate slug from brand + model
  if (data.model && !data.slug) {
    data.slug = generateSlug(`${data.brand} ${data.model}`);
  }

  // Generate duplicate key
  const brand = data.brand.toLowerCase().replace(/[^a-z0-9]/g, '');
  const model = data.model.toLowerCase().replace(/[^a-z0-9]/g, '');
  const duplicateKey = `${brand}|${model}`;

  return {
    originalRowNumber: rowIndex,
    originalRecord: raw,
    normalizedData: data,
    warnings,
    errors,
    duplicateKey,
  };
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isValidPhoneRecord(record: NormalizedPhoneImportRecord): boolean {
  return record.errors.length === 0 && !!record.normalizedData.brand && !!record.normalizedData.model;
}

export function getEmptyFieldInfo(records: NormalizedPhoneImportRecord[]): {
  recognizedFields: string[];
  ignoredFields: string[];
  missingFields: string[];
} {
  const allSpecs = new Set<string>();
  const recognized = new Set<string>();
  const missing = ['brand', 'model'];

  for (const r of records) {
    for (const [k] of Object.keys(r.normalizedData.specs)) allSpecs.add(k);
    if (r.warnings.length > 0 || r.errors.length > 0) continue;
    for (const [k] of Object.keys(r.normalizedData)) {
      if (k === 'specs' || k === 'benchmarks' || k === 'extra' || k === 'images') continue;
      recognized.add(k);
    }
  }

  const ignored: string[] = [];
  for (const r of records) {
    for (const [k] of Object.keys(r.originalRecord)) {
      const canon = FIELD_ALIASES[k.toLowerCase().replace(/[\s_-]/g, '')];
      if (!canon) ignored.push(k);
    }
  }

  return {
    recognizedFields: [...recognized].sort(),
    ignoredFields: [...new Set(ignored)].sort(),
    missingFields: missing.filter(f => !recognized.has(f)),
  };
}