import mongoose, { Schema, Document } from 'mongoose';

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
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>({
  siteName: { type: String, default: 'PhoneDock' },
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
    heroEnabled: true, heroBadge: "Pakistan's #1 Phone Database", heroTitle: 'Find Your Perfect', heroHighlight: 'Smartphone', heroSubtitle: 'Compare specs, check PTA status, read reviews, and find the best prices in Pakistan.', searchPlaceholder: 'Search phones, brands or chipsets...', cta1Text: '', cta1Url: '', cta2Text: '', cta2Url: '',
    sections: { brands: true, latest: true, trending: true, camera: true, gaming: true, battery: true, budget: true, flagship: true, upcoming: true, reviews: true, videos: true, news: true, sponsors: true, newsletter: true, trust: true },
    titles: { brands: 'Popular Brands', latest: 'Latest Phones', trending: 'Trending Phones', camera: 'Best Camera Phones', gaming: 'Best Gaming Phones', battery: 'Best Battery Phones', budget: 'Budget Champions', flagship: 'Premium Flagships', upcoming: 'Upcoming Phones', reviews: 'Latest Reviews', videos: 'Latest Videos', news: 'Latest News' }
  } },
  announcement: { type: Schema.Types.Mixed, default: { enabled: false, text: '', buttonText: '', buttonUrl: '', background: '#2563eb' } },
  theme: { type: Schema.Types.Mixed, default: { primaryColor: '#2563eb', secondaryColor: '#7c3aed', accentColor: '#06b6d4' } },
}, { timestamps: true });

// Singleton: only one document
export const Settings = (mongoose.models.Settings as mongoose.Model<ISettings>) || mongoose.model<ISettings>('Settings', SettingsSchema);

// Helper: get settings, create defaults if not exist
export async function getSettings(): Promise<ISettings> {
  let settings: ISettings | null = await Settings.findOne().lean() as ISettings | null;
  if (!settings) {
    const created = await Settings.create({});
    settings = await Settings.findById(created._id).lean() as unknown as ISettings;
  }
  return settings as ISettings;
}