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
  maintenanceMode: { type: Boolean, default: false },
  footerText: { type: String, default: '' },
  homepage: { type: Schema.Types.Mixed, default: {
    heroEnabled: true, heroBadge: "Pakistan's #1 Phone Database", heroTitle: 'Find Your Perfect', heroHighlight: 'Smartphone', heroSubtitle: 'Compare specs, check PTA status, read reviews, and find the best prices in Pakistan.', searchPlaceholder: 'Search phones, brands or chipsets...', cta1Text: 'Browse Phones', cta1Url: '/phones', cta2Text: 'Compare', cta2Url: '/compare', heroAnimationEnabled: true, heroAnimationSpeed: 5000, heroShowPhoneInfo: true, heroPhoneSlugs: [],
    sections: { brands: true, latest: true, trending: true, camera: true, gaming: true, battery: true, budget: true, flagship: true, upcoming: true, reviews: true, videos: true, news: true, sponsors: true, newsletter: true, trust: true },
    hideEmptySections: true, showOnlyBrandsWithPhones: true, brandLimit: 11, brandColumns: 6, brandLogoSize: 56, trendingMonths: 12, trendingMinRating: 7.5, trendingBalancePriceTiers: true,
    yearMode: 'data', yearStart: 2015, yearEnd: new Date().getFullYear() + 1, yearLimit: 12,
    priceRanges: [
      { id: '5k-20k', label: 'Rs. 5,000 – 20,000', min: 5000, max: 20000, enabled: true },
      { id: '20k-40k', label: 'Rs. 20,001 – 40,000', min: 20001, max: 40000, enabled: true },
      { id: '40k-60k', label: 'Rs. 40,001 – 60,000', min: 40001, max: 60000, enabled: true },
      { id: '60k-80k', label: 'Rs. 60,001 – 80,000', min: 60001, max: 80000, enabled: true },
      { id: '80k-100k', label: 'Rs. 80,001 – 100,000', min: 80001, max: 100000, enabled: true },
      { id: '100k-150k', label: 'Rs. 100,001 – 150,000', min: 100001, max: 150000, enabled: true },
      { id: '150k-200k', label: 'Rs. 150,001 – 200,000', min: 150001, max: 200000, enabled: true },
      { id: '200k-300k', label: 'Rs. 200,001 – 300,000', min: 200001, max: 300000, enabled: true },
      { id: '300k-400k', label: 'Rs. 300,001 – 400,000', min: 300001, max: 400000, enabled: true },
      { id: '400k-500k', label: 'Rs. 400,001 – 500,000', min: 400001, max: 500000, enabled: true },
      { id: '500k-600k', label: 'Rs. 500,001 – 600,000', min: 500001, max: 600000, enabled: true },
      { id: '600k-plus', label: 'Above Rs. 600,000', min: 600001, max: null, enabled: true },
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

// Helper: get settings, create defaults if not exist
export async function getSettings(): Promise<ISettings> {
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
