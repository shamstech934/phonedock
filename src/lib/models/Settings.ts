import mongoose, { Schema, Document } from 'mongoose';
import { connectDB } from '@/lib/mongodb';

export interface ISettings extends Document {
  siteName: string;
  tagline: string;
  contactEmail: string;
  supportEmail: string;
  logo: string;
  favicon: string;
  facebook: string;
  twitter: string;
  instagram: string;
  youtubeChannel: string;
  titleSuffix: string;
  metaDescription: string;
  ogImage: string;
  googleAnalyticsId: string;
  googleSiteVerification: string;
  bingSiteVerification: string;
  canonicalDomain: string;
  phoneTitleTemplate: string;
  brandTitleTemplate: string;
  indexEmptyBrands: boolean;
  maintenanceMode: boolean;
  footerText: string;
  homepage: Record<string, unknown>;
  announcement: Record<string, unknown>;
  theme: Record<string, unknown>;
  catalogLayout: Record<string, unknown>;
  mobileApp: Record<string, unknown>;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>({
  siteName: { type: String, default: 'SpecsDekh' },
  tagline: { type: String, default: '' },
  contactEmail: { type: String, default: '' },
  supportEmail: { type: String, default: '' },
  logo: { type: String, default: '' },
  favicon: { type: String, default: '' },
  facebook: { type: String, default: '' },
  twitter: { type: String, default: '' },
  instagram: { type: String, default: '' },
  youtubeChannel: { type: String, default: '' },
  titleSuffix: { type: String, default: '' },
  metaDescription: { type: String, default: '' },
  ogImage: { type: String, default: '' },
  googleAnalyticsId: { type: String, default: '' },
  googleSiteVerification: { type: String, default: '' },
  bingSiteVerification: { type: String, default: '' },
  canonicalDomain: { type: String, default: 'https://specsdekh.com' },
  phoneTitleTemplate: { type: String, default: '{brand} {model} Price in Pakistan {year} | Specs, PTA & Review' },
  brandTitleTemplate: { type: String, default: '{brand} Phones Price in Pakistan ({year})' },
  indexEmptyBrands: { type: Boolean, default: false },
  maintenanceMode: { type: Boolean, default: false },
  footerText: { type: String, default: '' },
  homepage: { type: Schema.Types.Mixed, default: {
    heroEnabled: true, heroBadge: "Pakistan's #1 Phone Database", heroTitle: 'Find Your Perfect', heroHighlight: 'Smartphone', heroSubtitle: 'Compare specs, check PTA status, read reviews, and find the best prices in Pakistan.', searchPlaceholder: 'Search phones, brands or chipsets...', cta1Text: 'Browse Phones', cta1Url: '/phones', cta2Text: 'Compare', cta2Url: '/compare', heroAnimationEnabled: true, heroAnimationSpeed: 5000, heroShowPhoneInfo: true, heroPhoneSlugs: [],
    sections: { brands: true, latest: true, trending: true, camera: true, gaming: true, battery: true, budget: true, flagship: true, upcoming: true, reviews: true, videos: true, news: true, sponsors: true, newsletter: true, trust: true },
    hideEmptySections: true, showOnlyBrandsWithPhones: true, brandLimit: 11, brandColumns: 6, brandLogoSize: 56, trendingMonths: 12, trendingMinRating: 7.5, trendingBalancePriceTiers: true,
    yearMode: 'data', yearStart: 2015, yearEnd: new Date().getFullYear() + 1, yearLimit: 12,
    priceRanges: [
      { id: 'under-25000', label: 'Rs. 1 – 24,999', min: 1, max: 24999, enabled: true },
      { id: '25000-50000', label: 'Rs. 25,000 – 49,999', min: 25000, max: 49999, enabled: true },
      { id: '50000-100000', label: 'Rs. 50,000 – 99,999', min: 50000, max: 99999, enabled: true },
      { id: '100000-150000', label: 'Rs. 100,000 – 149,999', min: 100000, max: 149999, enabled: true },
      { id: '150000-250000', label: 'Rs. 150,000 – 249,999', min: 150000, max: 249999, enabled: true },
      { id: 'above-250000', label: 'Rs. 250,000+', min: 250000, max: null, enabled: true },
    ],
    sectionOrder: ['latest', 'trending', 'camera', 'gaming', 'battery', 'budget', 'flagship', 'upcoming', 'reviews', 'videos', 'news'],
    titles: { brands: 'Popular Brands', latest: 'Latest Phones', trending: 'Trending Phones', camera: 'Best Camera Phones', gaming: 'Best Gaming Phones', battery: 'Best Battery Phones', budget: 'Budget Champions', flagship: 'Premium Flagships', upcoming: 'Upcoming Phones', reviews: 'Latest Reviews', videos: 'Latest Videos', news: 'Latest News' }
  } },
  announcement: { type: Schema.Types.Mixed, default: { enabled: false, text: '', buttonText: '', buttonUrl: '', background: '#2563eb' } },
  theme: { type: Schema.Types.Mixed, default: { primaryColor: '#2563eb', secondaryColor: '#7c3aed', accentColor: '#06b6d4' } },
  catalogLayout: { type: Schema.Types.Mixed, default: {
    home: { desktop: 4, tablet: 3, mobile: 2, density: 'comfortable' },
    phones: { desktop: 4, tablet: 3, mobile: 2, density: 'comfortable' },
    brands: { desktop: 5, tablet: 3, mobile: 2, density: 'compact' },
    search: { desktop: 4, tablet: 3, mobile: 2, density: 'comfortable' },
    rankings: { desktop: 4, tablet: 3, mobile: 2, density: 'comfortable' },
    related: { desktop: 4, tablet: 4, mobile: 2, density: 'compact' },
    guides: { desktop: 5, tablet: 3, mobile: 2, density: 'compact' },
  } },
  mobileApp: { type: Schema.Types.Mixed, default: {
    enabled: true,
    maintenanceMode: false,
    maintenanceTitle: 'SpecsDekh is being improved',
    maintenanceMessage: 'Please check back shortly.',
    minimumVersion: '0.1.0',
    latestVersion: '0.1.0',
    forceUpdate: false,
    updateUrlAndroid: '',
    updateUrlIos: '',
    supportUrl: '/contact',
    homeSections: ['hero', 'latest', 'brands', 'features', 'priceGroups'],
    navigation: {
      home: true, phones: true, search: true, brands: true, saved: true,
    },
    features: {
      compare: true, savedPhones: true, priceAlerts: false, news: false,
      reviews: false, videos: false, account: false,
    },
    campaign: {
      enabled: false, title: '', message: '', image: '', actionLabel: '', actionUrl: '',
    },
  } },
}, { timestamps: true });

// Singleton: only one document
export const Settings = (mongoose.models.Settings as mongoose.Model<ISettings>) || mongoose.model<ISettings>('Settings', SettingsSchema);

type SettingsCache = {
  value?: ISettings;
  expiresAt: number;
  inFlight?: Promise<ISettings>;
};

const SETTINGS_CACHE_TTL_MS = 60_000;
const globalSettingsCache = globalThis as typeof globalThis & {
  __specsDekhSettingsCache?: SettingsCache;
};

// Helper: load settings, create defaults if not present.
async function loadSettings(): Promise<ISettings> {
  await connectDB();
  let settings: ISettings | null = await Settings.findOne().lean() as ISettings | null;
  if (!settings) {
    const created = await Settings.create({});
    settings = await Settings.findById(created._id).lean() as unknown as ISettings;
  }

  // One-time, backward-compatible brand migration for databases created before SpecsDekh.
  // Internal collection names and authentication issuers remain unchanged.
  const legacyUpdates: Record<string, string> = {};
  if (!settings.siteName || settings.siteName === 'PhoneDock') legacyUpdates.siteName = 'SpecsDekh';
  if (!settings.titleSuffix || settings.titleSuffix.includes('PhoneDock')) legacyUpdates.titleSuffix = 'SpecsDekh Pakistan';
  if (!settings.contactEmail || settings.contactEmail.endsWith('@phonedock.pk')) legacyUpdates.contactEmail = 'info@specsdekh.com';
  if (!settings.supportEmail || settings.supportEmail.endsWith('@phonedock.pk')) legacyUpdates.supportEmail = 'support@specsdekh.com';
  if (!settings.logo) legacyUpdates.logo = '/logo.svg';
  if (!settings.favicon) legacyUpdates.favicon = '/favicon.svg';
  if (!settings.ogImage) legacyUpdates.ogImage = '/og-image.png';

  if (Object.keys(legacyUpdates).length > 0) {
    await Settings.updateOne({ _id: settings._id }, { $set: legacyUpdates });
    settings = { ...settings, ...legacyUpdates } as ISettings;
  }

  // Migrate the old 7-column / 13-brand layout to complete six-column rows.
  const homepage = (settings.homepage || {}) as Record<string, unknown>;
  const homepageUpdates: Record<string, unknown> = {};
  if (homepage.brandLimit === undefined || homepage.brandLimit === 13) homepageUpdates['homepage.brandLimit'] = 11;
  if (homepage.brandColumns === undefined || homepage.brandColumns === 7) homepageUpdates['homepage.brandColumns'] = 6;
  if (homepage.brandLogoSize === undefined || homepage.brandLogoSize === 48) homepageUpdates['homepage.brandLogoSize'] = 56;
  if (Object.keys(homepageUpdates).length > 0) {
    await Settings.updateOne({ _id: settings._id }, { $set: homepageUpdates });

    // Keep the lean settings object type-safe. homepageUpdates is intentionally
    // Record<string, unknown>, so only copy values after narrowing them.
    const nextHomepage: Record<string, unknown> = { ...homepage };
    const nextBrandLimit = homepageUpdates['homepage.brandLimit'];
    const nextBrandColumns = homepageUpdates['homepage.brandColumns'];
    const nextBrandLogoSize = homepageUpdates['homepage.brandLogoSize'];

    if (typeof nextBrandLimit === 'number') nextHomepage.brandLimit = nextBrandLimit;
    if (typeof nextBrandColumns === 'number') nextHomepage.brandColumns = nextBrandColumns;
    if (typeof nextBrandLogoSize === 'number') nextHomepage.brandLogoSize = nextBrandLogoSize;

    settings.homepage = nextHomepage;
  }

  return settings as ISettings;
}

/**
 * Metadata, layout and page data can request the same singleton during one
 * render. A short process cache removes duplicate MongoDB work and shares an
 * in-flight cold read, while keeping CMS/maintenance changes responsive.
 */
export async function getSettings(): Promise<ISettings> {
  const now = Date.now();
  const cache = globalSettingsCache.__specsDekhSettingsCache;
  if (cache?.value && cache.expiresAt > now) return cache.value;
  if (cache?.inFlight) return cache.inFlight;

  const nextCache: SettingsCache = cache || { expiresAt: 0 };
  const request = loadSettings()
    .then(settings => {
      nextCache.value = settings;
      nextCache.expiresAt = Date.now() + SETTINGS_CACHE_TTL_MS;
      return settings;
    })
    .finally(() => {
      nextCache.inFlight = undefined;
    });

  nextCache.inFlight = request;
  globalSettingsCache.__specsDekhSettingsCache = nextCache;
  return request;
}

export function invalidateSettingsCache(): void {
  globalSettingsCache.__specsDekhSettingsCache = undefined;
}
