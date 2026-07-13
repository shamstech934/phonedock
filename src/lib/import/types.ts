// ============ IMPORT SYSTEM TYPES ============

export interface RawPhoneRecord {
  brand?: string;
  brandSlug?: string;
  model?: string;
  modelName?: string;
  slug?: string;
  pricePKR?: number | string;
  price?: number | string;
  ptaStatus?: string;
  ptaApproved?: boolean | string;
  featured?: boolean | string;
  trending?: boolean | string;
  upcoming?: boolean | string;
  thumbnail?: string;
  images?: string | string[];
  description?: string;
  releaseDate?: string;
  cameraScore?: number | string;
  performanceScore?: number | string;
  batteryScore?: number | string;
  displayScore?: number | string;
  valueScore?: number | string;
  overallRating?: number | string;
  pros?: string;
  cons?: string;
  reviewSummary?: string;
  reviewVerdict?: string;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string;
  category?: string;
  // Specs fields
  display?: string;
  displayType?: string;
  resolution?: string;
  refreshRate?: string;
  protection?: string;
  brightness?: string;
  chipset?: string;
  cpu?: string;
  gpu?: string;
  process?: string;
  ram?: string;
  ramType?: string;
  storage?: string;
  cardSlot?: string;
  mainCamera?: string;
  mainCameraSensor?: string;
  aperture?: string;
  ois?: string;
  eis?: string;
  ultrawide?: string;
  telephoto?: string;
  zoom?: string;
  cameraFeatures?: string;
  videoRecording?: string;
  selfieCamera?: string;
  selfieSensor?: string;
  selfieVideo?: string;
  battery?: string;
  charging?: string;
  chargingSpeed?: string;
  wirelessCharge?: string;
  wirelessSpeed?: string;
  reverseCharge?: string;
  weight?: string;
  dimensions?: string;
  build?: string;
  sim?: string;
  ipRating?: string;
  network?: string;
  fiveG?: string;
  '5g'?: string;
  wifi?: string;
  bluetooth?: string;
  nfc?: string;
  usb?: string;
  fingerprint?: string;
  faceUnlock?: string;
  sensors?: string;
  colors?: string;
  os?: string;
  osVersion?: string;
  osUI?: string;
  updatePolicy?: string;
  specialFeatures?: string;
  // Benchmark fields
  antutu?: number | string;
  geekbenchSingle?: number | string;
  geekbenchMulti?: number | string;
  gamingScore?: number | string;
  pubgFps?: string;
  codMobileFps?: string;
  genshinFps?: string;
  videoPlayback?: string;
  gamingBattery?: string;
  browsingBattery?: string;
  [key: string]: any;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
  phone: RawPhoneRecord;
}

export interface ImportResult {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; model: string; error: string }>;
  warnings: string[];
  duration: number;
}

export interface ImportHistoryEntry {
  _id?: string;
  filename: string;
  fileType: 'json' | 'csv' | 'xlsx';
  totalRecords: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; model: string; error: string }>;
  status: 'completed' | 'partial' | 'failed' | 'rolled_back';
  duration: number;
  batchSize: number;
  createdAt: Date;
}

export interface SyncJobEntry {
  _id?: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  source: string;
  totalPhones: number;
  processed: number;
  inserted: number;
  updated: number;
  errors: number;
  errorLog: string[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export type PhoneCategory =
  | 'Budget'
  | 'Mid Range'
  | 'Premium'
  | 'Flagship'
  | 'Ultra Flagship'
  | 'Gaming'
  | 'Camera'
  | 'Battery'
  | 'Foldable'
  | 'Tablet';