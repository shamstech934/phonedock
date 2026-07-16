// ─── Types ───────────────────────────────────────────────────────────────────

export interface Brand {
  id: string;
  name: string;
  slug: string;
}

export interface PhoneImage {
  url: string;
  altText: string;
}

export interface PhonePrice {
  storeName: string;
  price: number | '';
  url: string;
  inStock: boolean;
}

export interface PhoneFormProps {
  phoneId?: string | null;
  brands: Array<{ id: string; name: string; slug: string }>;
  onSave: () => void;
  onCancel: () => void;
}

export interface PhoneFormData {
  brand: string;
  modelName: string;
  slug: string;
  pakistaniPricePKR: number | '';
  originalPricePKR: number | '';
  ptaStatus: string;
  ptaApproved: boolean;
  releaseDate: string;
  thumbnailUrl: string;
  description: string;
  status: string;
  featured: boolean;
  trending: boolean;
  upcoming: boolean;
  // Display & Processor
  display: string;
  displayType: string;
  resolution: string;
  refreshRate: string;
  protection: string;
  brightness: string;
  chipset: string;
  cpu: string;
  gpu: string;
  process: string;
  ram: string;
  ramType: string;
  storage: string;
  cardSlot: string;
  // Camera
  mainCamera: string;
  mainCameraSensor: string;
  aperture: string;
  ois: string;
  eis: string;
  ultrawide: string;
  telephoto: string;
  zoom: string;
  cameraFeatures: string;
  videoRecording: string;
  selfieCamera: string;
  selfieSensor: string;
  selfieVideo: string;
  // Battery & Body
  battery: string;
  charging: string;
  chargingSpeed: string;
  wirelessCharge: string;
  wirelessSpeed: string;
  reverseCharge: string;
  weight: string;
  dimensions: string;
  build: string;
  sim: string;
  ipRating: string;
  colors: string;
  // Connectivity & OS
  network: string;
  fiveG: string;
  wifi: string;
  bluetooth: string;
  nfc: string;
  usb: string;
  fingerprint: string;
  faceUnlock: string;
  sensors: string;
  os: string;
  osVersion: string;
  osUI: string;
  updatePolicy: string;
  specialFeatures: string;
  // Benchmarks & Ratings
  antutuScore: number | '';
  geekbenchSingle: number | '';
  geekbenchMulti: number | '';
  gamingScore: number | '';
  pubgFPS: string;
  codMobileFPS: string;
  genshinFPS: string;
  videoPlayback: string;
  gamingBattery: string;
  browsingBattery: string;
  cameraScore: number | '';
  performanceScore: number | '';
  batteryScore: number | '';
  displayScore: number | '';
  valueScore: number | '';
  overallRating: number | '';
  // Review & SEO
  pros: string;
  cons: string;
  reviewSummary: string;
  reviewVerdict: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string;
  // Numeric filter fields (Phase 3)
  ramGB: number | '';
  storageGB: number | '';
  screenSizeInch: number | '';
  mainCameraMP: number | '';
  batteryMAh: number | '';
  // Images & Prices
  images: PhoneImage[];
  prices: PhonePrice[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const STORE_NAMES = [
  'Daraz',
  'PriceOye',
  'Whatmobile',
  'Telemart',
  'iShopping',
  'Yayvo',
] as const;

export const TABS = [
  'Basic Info',
  'Display & Processor',
  'Camera',
  'Battery & Body',
  'Connectivity & OS',
  'Benchmarks & Ratings',
  'Review & SEO',
  'Images & Prices',
  'Video Review',
] as const;

export const EMPTY_IMAGE: PhoneImage = { url: '', altText: '' };

export const EMPTY_PRICE: PhonePrice = {
  storeName: 'Daraz',
  price: '',
  url: '',
  inStock: true,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toNumberOrEmpty(value: unknown): number | '' {
  if (value === '' || value === null || value === undefined) return '';
  const n = Number(value);
  return isNaN(n) ? '' : n;
}

export const createEmptyFormData = (): PhoneFormData => ({
  brand: '',
  modelName: '',
  slug: '',
  pakistaniPricePKR: '',
  originalPricePKR: '',
  ptaStatus: 'Unknown',
  ptaApproved: false,
  releaseDate: '',
  thumbnailUrl: '',
  description: '',
  status: 'draft',
  featured: false,
  trending: false,
  upcoming: false,
  display: '',
  displayType: '',
  resolution: '',
  refreshRate: '',
  protection: '',
  brightness: '',
  chipset: '',
  cpu: '',
  gpu: '',
  process: '',
  ram: '',
  ramType: '',
  storage: '',
  cardSlot: '',
  mainCamera: '',
  mainCameraSensor: '',
  aperture: '',
  ois: '',
  eis: '',
  ultrawide: '',
  telephoto: '',
  zoom: '',
  cameraFeatures: '',
  videoRecording: '',
  selfieCamera: '',
  selfieSensor: '',
  selfieVideo: '',
  battery: '',
  charging: '',
  chargingSpeed: '',
  wirelessCharge: '',
  wirelessSpeed: '',
  reverseCharge: '',
  weight: '',
  dimensions: '',
  build: '',
  sim: '',
  ipRating: '',
  colors: '',
  network: '',
  fiveG: '',
  wifi: '',
  bluetooth: '',
  nfc: '',
  usb: '',
  fingerprint: '',
  faceUnlock: '',
  sensors: '',
  os: '',
  osVersion: '',
  osUI: '',
  updatePolicy: '',
  specialFeatures: '',
  antutuScore: '',
  geekbenchSingle: '',
  geekbenchMulti: '',
  gamingScore: '',
  pubgFPS: '',
  codMobileFPS: '',
  genshinFPS: '',
  videoPlayback: '',
  gamingBattery: '',
  browsingBattery: '',
  cameraScore: '',
  performanceScore: '',
  batteryScore: '',
  displayScore: '',
  valueScore: '',
  overallRating: '',
  pros: '',
  cons: '',
  reviewSummary: '',
  reviewVerdict: '',
  seoTitle: '',
  seoDescription: '',
  keywords: '',
  ramGB: '',
  storageGB: '',
  screenSizeInch: '',
  mainCameraMP: '',
  batteryMAh: '',
  images: [],
  prices: [],
});