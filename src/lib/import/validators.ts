import { RawPhoneRecord, ValidationError, ValidationResult } from './types';

// ============ SLUG GENERATOR ============
export function generateSlug(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ============ FIELD NORMALIZER ============
function toBool(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim();
    return ['true', 'yes', '1', 'on'].includes(lower);
  }
  return false;
}

function toNum(val: any, fallback = 0): number {
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? fallback : num;
  }
  return fallback;
}

function toStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

// ============ IMAGE URL VALIDATOR ============
function isValidImageUrl(url: string): boolean {
  if (!url || url.length < 5) return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ============ SPEC FIELD KEYS ============
const SPEC_KEYS = [
  'display', 'displayType', 'resolution', 'refreshRate', 'protection', 'brightness',
  'chipset', 'cpu', 'gpu', 'process', 'ram', 'ramType', 'storage', 'cardSlot',
  'mainCamera', 'mainCameraSensor', 'aperture', 'ois', 'eis', 'ultrawide', 'telephoto',
  'zoom', 'cameraFeatures', 'videoRecording', 'selfieCamera', 'selfieSensor', 'selfieVideo',
  'battery', 'charging', 'chargingSpeed', 'wirelessCharge', 'wirelessSpeed', 'reverseCharge',
  'weight', 'dimensions', 'build', 'sim', 'ipRating', 'network', 'wifi', 'bluetooth',
  'nfc', 'usb', 'fingerprint', 'faceUnlock', 'sensors', 'colors',
  'os', 'osVersion', 'osUI', 'updatePolicy', 'specialFeatures',
];

const BENCHMARK_KEYS = [
  'antutu', 'geekbenchSingle', 'geekbenchMulti', 'gamingScore',
  'pubgFps', 'codMobileFps', 'genshinFps', 'videoPlayback', 'gamingBattery', 'browsingBattery',
];

// ============ VALIDATE SINGLE RECORD ============
export function validatePhoneRecord(
  record: RawPhoneRecord,
  rowIndex: number,
  existingSlugs?: Set<string>
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];
  const phone: RawPhoneRecord = { ...record };

  // Normalize modelName
  phone.modelName = toStr(phone.model || phone.modelName);
  if (!phone.modelName) {
    errors.push({ row: rowIndex, field: 'modelName', message: 'Model name is required', value: record.modelName });
    return { valid: false, errors, warnings, phone };
  }

  // Normalize brand
  phone.brand = toStr(phone.brand);
  if (!phone.brand) {
    errors.push({ row: rowIndex, field: 'brand', message: 'Brand is required', value: record.brand });
  }

  // Normalize slug
  if (!phone.slug) {
    phone.slug = generateSlug(phone.modelName);
  } else {
    phone.slug = generateSlug(phone.slug);
  }

  if (!phone.slug) {
    errors.push({ row: rowIndex, field: 'slug', message: 'Could not generate valid slug', value: phone.slug });
  }

  // Check for invalid slug characters
  if (phone.slug && !/^[a-z0-9-]+$/.test(phone.slug)) {
    errors.push({ row: rowIndex, field: 'slug', message: 'Slug contains invalid characters (only a-z, 0-9, - allowed)', value: phone.slug });
  }

  // Check duplicate slugs (in-batch)
  if (existingSlugs && phone.slug && existingSlugs.has(phone.slug)) {
    warnings.push(`Row ${rowIndex}: Duplicate slug "${phone.slug}" — will update existing phone`);
  }

  // Normalize price
  const rawPrice = phone.pricePKR ?? phone.price;
  phone.pricePKR = toNum(rawPrice, 0);
  if (phone.pricePKR < 0) {
    errors.push({ row: rowIndex, field: 'pricePKR', message: 'Price cannot be negative', value: phone.pricePKR });
  }

  // Normalize booleans
  phone.ptaApproved = toBool(phone.ptaApproved);
  phone.featured = toBool(phone.featured);
  phone.trending = toBool(phone.trending);
  phone.upcoming = toBool(phone.upcoming);

  // Normalize PTA status
  phone.ptaStatus = toStr(phone.ptaStatus) || 'Unknown';

  // Normalize scores (0-100)
  const scoreFields = ['cameraScore', 'performanceScore', 'batteryScore', 'displayScore', 'valueScore', 'overallRating'] as const;
  for (const field of scoreFields) {
    phone[field] = Math.min(100, Math.max(0, toNum(phone[field], 0)));
  }

  // Validate thumbnail/image URLs
  phone.thumbnail = toStr(phone.thumbnail);
  if (phone.thumbnail && !isValidImageUrl(phone.thumbnail)) {
    warnings.push(`Row ${rowIndex}: Thumbnail URL may be invalid: "${phone.thumbnail}"`);
  }

  // Normalize images array
  if (typeof phone.images === 'string') {
    phone.images = phone.images.split(',').map((s: string) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(phone.images)) {
    const validImages: string[] = [];
    for (const img of phone.images) {
      const url = toStr(img);
      if (isValidImageUrl(url)) {
        validImages.push(url);
      } else if (url) {
        warnings.push(`Row ${rowIndex}: Image URL may be invalid: "${url}"`);
      }
    }
    phone.images = validImages;
  }

  // Normalize 5G field (support both '5g' and 'fiveG' keys)
  if (phone['5g'] && !phone.fiveG) {
    phone.fiveG = toStr(phone['5g']);
  }

  // Validate benchmarks (numeric fields)
  for (const key of BENCHMARK_KEYS) {
    if (phone[key] !== undefined && phone[key] !== '') {
      if (['pubgFps', 'codMobileFps', 'genshinFps', 'videoPlayback', 'gamingBattery', 'browsingBattery'].includes(key)) {
        phone[key] = toStr(phone[key]);
      } else {
        phone[key] = toNum(phone[key], 0);
        if (phone[key] < 0) {
          errors.push({ row: rowIndex, field: key, message: `${key} cannot be negative`, value: phone[key] });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    phone,
  };
}

// ============ EXTRACT PHONE DATA FROM VALIDATED RECORD ============
export function extractPhoneData(phone: RawPhoneRecord) {
  const phoneData: Record<string, any> = {
    modelName: phone.modelName,
    slug: phone.slug,
    pricePKR: phone.pricePKR || 0,
    ptaStatus: phone.ptaStatus || 'Unknown',
    ptaApproved: phone.ptaApproved || false,
    featured: phone.featured || false,
    trending: phone.trending || false,
    upcoming: phone.upcoming || false,
    thumbnail: phone.thumbnail || '',
    description: phone.description || '',
    cameraScore: phone.cameraScore || 0,
    performanceScore: phone.performanceScore || 0,
    batteryScore: phone.batteryScore || 0,
    displayScore: phone.displayScore || 0,
    valueScore: phone.valueScore || 0,
    overallRating: phone.overallRating || 0,
    releaseDate: phone.releaseDate || '',
    pros: phone.pros || '',
    cons: phone.cons || '',
    reviewSummary: phone.reviewSummary || '',
    reviewVerdict: phone.reviewVerdict || '',
    seoTitle: phone.seoTitle || '',
    seoDescription: phone.seoDescription || '',
    keywords: phone.keywords || '',
  };

  // Remove undefined keys
  for (const key of Object.keys(phoneData)) {
    if (phoneData[key] === undefined) delete phoneData[key];
  }

  // Extract specs
  const specsData: Record<string, any> = {};
  for (const key of SPEC_KEYS) {
    if (phone[key] !== undefined && phone[key] !== null && String(phone[key]).trim() !== '') {
      specsData[key] = String(phone[key]).trim();
    }
  }

  // Extract benchmarks
  const benchData: Record<string, any> = {};
  for (const key of BENCHMARK_KEYS) {
    if (phone[key] !== undefined && phone[key] !== null && String(phone[key]).trim() !== '') {
      benchData[key] = key === 'antutu' || key === 'geekbenchSingle' || key === 'geekbenchMulti' || key === 'gamingScore'
        ? toNum(phone[key], 0)
        : String(phone[key]).trim();
    }
  }

  // Extract images
  const images: string[] = Array.isArray(phone.images) ? phone.images : [];

  return { phoneData, specsData, benchData, images, brandName: phone.brand || '' };
}