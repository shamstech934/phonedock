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
}, { timestamps: true });

// Singleton: only one document
export const Settings = (mongoose.models.Settings as mongoose.Model<ISettings>) || mongoose.model<ISettings>('Settings', SettingsSchema);

// Helper: get settings, create defaults if not exist
export async function getSettings(): Promise<ISettings> {
  let settings = await Settings.findOne().lean();
  if (!settings) {
    settings = await Settings.create({});
    settings = await Settings.findById(settings._id).lean() as any;
  }
  return settings as any;
}