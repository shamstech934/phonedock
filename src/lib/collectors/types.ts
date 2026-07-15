// ============ COLLECTOR SYSTEM TYPES ============

// ---- Provider Types ----
export type ProviderType = 'json_url' | 'csv_url' | 'api' | 'manufacturer' | 'manual_url' | 'file_upload';

export interface ProviderConfig {
  type: ProviderType;
  endpoint?: string;
  apiKeyEnvVar?: string;        // e.g. 'PHONE_DATA_API_KEY'
  apiKeyHeader?: string;        // 'Authorization' (default) or 'x-api-key'
  headers?: Record<string, string>;
  brandFilter?: string[];       // e.g. ['Samsung', 'Apple']
  countryFilter?: string;       // e.g. 'Pakistan'
  region?: string;              // e.g. 'South Asia'
  syncFrequencyHours?: number;  // 0 = manual only
  pagination?: { pageSize: number; pageParam?: string; maxPages?: number };
  dataPath?: string;            // JSON path to phone array, e.g. 'data.phones'
  mappingRules?: Record<string, string>; // provider field → our field
  enabled: boolean;
}

// ---- Normalized Phone Spec (what every provider must return) ----
export interface NormalizedDisplay {
  type?: string;
  size?: string;
  resolution?: string;
  aspectRatio?: string;
  pixelDensity?: string;
  refreshRate?: string;
  brightness?: string;
  protection?: string;
  hdrSupport?: string;
}

export interface NormalizedProcessor {
  chipset?: string;
  cpu?: string;
  gpu?: string;
  process?: string;
}

export interface NormalizedMemory {
  ram?: string;
  ramType?: string;
  storage?: string;
  storageType?: string;
  cardSlot?: string;
}

export interface NormalizedCamera {
  rearModules?: string;
  frontCamera?: string;
  aperture?: string;
  sensorSize?: string;
  ois?: string;
  eis?: string;
  zoom?: string;
  videoRecording?: string;
  cameraFeatures?: string;
}

export interface NormalizedBattery {
  capacity?: string;
  type?: string;
  wiredCharging?: string;
  wirelessCharging?: string;
  reverseCharging?: string;
}

export interface NormalizedBody {
  dimensions?: string;
  weight?: string;
  build?: string;
  waterResistance?: string;
  colors?: string;
  sim?: string;
}

export interface NormalizedConnectivity {
  network?: string;
  fiveG?: string;
  wifi?: string;
  bluetooth?: string;
  nfc?: string;
  usb?: string;
  gps?: string;
  infrared?: string;
}

export interface NormalizedSoftware {
  os?: string;
  osVersion?: string;
  osUI?: string;
  updatePolicy?: string;
}

export interface NormalizedAudio {
  speakers?: string;
  headphoneJack?: string;
}

export interface NormalizedSensors {
  fingerprint?: string;
  accelerometer?: string;
  gyroscope?: string;
  compass?: string;
  proximity?: string;
  others?: string;
}

export interface NormalizedBenchmarks {
  antutu?: number;
  geekbenchSingle?: number;
  geekbenchMulti?: number;
  gamingScore?: number;
  pubgFps?: string;
  codMobileFps?: string;
  genshinFps?: string;
}

export interface NormalizedPhone {
  // Basic
  brandName: string;
  model: string;
  slug: string;
  releaseDate?: string;
  announcedDate?: string;
  availability?: string;
  deviceStatus?: string;
  deviceType?: string;

  // Composed spec sections
  display?: NormalizedDisplay;
  processor?: NormalizedProcessor;
  memory?: NormalizedMemory;
  camera?: NormalizedCamera;
  battery?: NormalizedBattery;
  body?: NormalizedBody;
  connectivity?: NormalizedConnectivity;
  software?: NormalizedSoftware;
  audio?: NormalizedAudio;
  sensors?: NormalizedSensors;
  benchmarks?: NormalizedBenchmarks;

  // Media
  images?: string[];
  thumbnail?: string;

  // Pakistan-specific (never auto-populated from global sources)
  pakistanPrice?: number;
  pakistanMarketPrice?: number;
  ptaApproved?: boolean | null;
  ptaStatus?: string;
  ptaTaxEstimate?: number;
  officialWarranty?: string;
  localAvailability?: string;
  localSellerNotes?: string;
}

// ---- Data Provenance ----
export interface FieldProvenance {
  field: string;
  value: any;
  sourceName: string;
  sourceUrl: string;
  collectedAt: string;
  providerId: string;
  providerRecordId?: string;
  confidence: number; // 0-1
  rawHash?: string;
}

export interface ConflictInfo {
  field: string;
  existingValue: any;
  newValue: any;
  existingSource: string;
  newSource: string;
  confidence: number;
}

// ---- Collected Phone (MongoDB) ----
export type DraftStatus = 'pending' | 'needs_review' | 'approved' | 'rejected' | 'imported' | 'failed';

export interface DuplicateMatch {
  type: 'exact_slug' | 'brand_model' | 'normalized_name' | 'provider_record' | 'fuzzy';
  phoneId?: string;
  modelName?: string;
  brandName?: string;
  slug?: string;
  confidence: number;
}

// ---- Collector Job ----
export type JobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'partially_completed' | 'failed';

export interface JobProgress {
  fetched: number;
  normalized: number;
  newPhones: number;
  possibleUpdates: number;
  duplicates: number;
  conflicts: number;
  failures: number;
  totalExpected?: number;
}

// ---- Review Actions ----
export type ReviewAction = 'approve' | 'reject' | 'edit' | 'merge' | 'import_new' | 'save_draft' | 'mark_unreliable';

// ---- Category Suggestion ----
export type PhoneCategory =
  | 'Budget' | 'Mid Range' | 'Premium' | 'Flagship' | 'Ultra Flagship'
  | 'Gaming' | 'Camera' | 'Battery' | 'Foldable' | 'Tablet'
  | 'Rugged' | 'Compact';