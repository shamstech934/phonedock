import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  emailVerified: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'blocked'], default: 'active', index: true },
  lastLoginAt: { type: Date, default: null },
  sessionVersion: { type: Number, default: 0, min: 0 },
  avatarUrl: { type: String, default: '', maxlength: 500 },
  country: { type: String, default: 'PK', maxlength: 2, uppercase: true },
  timezone: { type: String, default: 'Asia/Karachi', maxlength: 80 },
  preferredCurrency: { type: String, default: 'PKR', maxlength: 3, uppercase: true },
  preferredLanguage: { type: String, default: 'en', maxlength: 10 },
  notificationSettings: {
    email: { type: Boolean, default: true },
    priceDrops: { type: Boolean, default: true },
    ptaChanges: { type: Boolean, default: true },
    restock: { type: Boolean, default: true },
  },
  privacySettings: {
    saveHistory: { type: Boolean, default: true },
    personalization: { type: Boolean, default: true },
  },
  deletedAt: { type: Date, default: null, select: false },
}, { timestamps: true });

export interface IUser extends mongoose.Document {
  name: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  status: 'active' | 'blocked';
  lastLoginAt: Date | null;
  sessionVersion: number;
  avatarUrl: string;
  country: string;
  timezone: string;
  preferredCurrency: string;
  preferredLanguage: string;
  createdAt: Date;
  updatedAt: Date;
}

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
