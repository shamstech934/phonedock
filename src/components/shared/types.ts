export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo: string;
  country: string;
  description: string;
  _count?: { phones: number };
}

export interface PhoneSpecs {
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
  // Numeric filter fields
  ramGB?: number;
  storageGB?: number;
  screenSizeInch?: number;
  mainCameraMP?: number;
  batteryMAh?: number;
}

export interface PhoneBenchmark {
  antutu: number;
  geekbenchSingle: number;
  geekbenchMulti: number;
  gamingScore: number;
  pubgFps?: string;
  codMobileFps?: string;
  genshinFps?: string;
  videoPlayback?: string;
  gamingBattery?: string;
  browsingBattery?: string;
}

export interface PhoneImage {
  id: string;
  url: string;
  altText: string;
  sortOrder: number;
}

export interface PhonePrice {
  id: string;
  storeName: string;
  price: number;
  url: string;
  inStock: boolean;
}

export interface Phone {
  id: string;
  modelName: string;
  slug: string;
  brandId: string;
  brand?: Brand;
  thumbnail: string;
  pricePKR: number;
  originalPricePKR: number;
  description: string;
  overallRating: number;
  cameraScore: number;
  performanceScore: number;
  batteryScore: number;
  displayScore: number;
  valueScore: number;
  ptaStatus: string;
  ptaApproved: boolean;
  releaseDate: string;
  trending: boolean;
  upcoming: boolean;
  featured: boolean;
  specs?: PhoneSpecs;
  benchmarks?: PhoneBenchmark;
  images?: PhoneImage[];
  prices?: PhonePrice[];
  videos?: Array<{ id: string; youtubeId: string; title: string; thumbnailUrl: string; publishedAt: string }>;
  pros?: string;
  cons?: string;
  reviewSummary?: string;
  reviewVerdict?: string;
  priceMode?: string;
  manualLock?: boolean;
  manualLockReason?: string;
  sourceUrl?: string;
  published?: boolean;
  status?: string;
  views?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  imageUrl: string;
  published: boolean;
  createdAt: string;
}

export interface HomeData {
  featured: Phone[];
  trending: Phone[];
  latest: Phone[];
  bestCamera: Phone[];
  bestGaming: Phone[];
  bestBattery: Phone[];
  upcoming: Phone[];
  news: NewsItem[];
  priceCategories: {
    above100k: Phone[];
    price60to100: Phone[];
    price40to60: Phone[];
    price20to40: Phone[];
    under20k: Phone[];
  };
  brands: Brand[];
  sponsors?: Sponsor[];
  totalPhones?: number;
  totalBrands?: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface Sponsor {
  id: string;
  name: string;
  image: string;
  url: string;
  position: string;
  active: boolean;
}

export interface ActivityLog {
  id: string;
  action: string;
  details: string;
  entityType: string;
  createdAt: string;
  admin?: { name: string; email: string };
}