import mongoose, { Schema } from 'mongoose';

const NewsSchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true },
  content: { type: String, default: '' },
  excerpt: { type: String, default: '' },
  category: { type: String, default: 'General' },
  image: { type: String, default: '' },
  author: { type: String, default: '' },
  published: { type: Boolean, default: false },
  featured: { type: Boolean, default: false },
  seoTitle: { type: String, default: '' },
  seoDescription: { type: String, default: '' },
  views: { type: Number, default: 0 },
  status: { type: String, default: 'published' },
}, { timestamps: true });

NewsSchema.index({ slug: 1 }, { unique: true });
NewsSchema.index({ status: 1 });
NewsSchema.index({ published: 1, status: 1 });

export const News = mongoose.models.News || mongoose.model('News', NewsSchema);

const SponsorSchema = new Schema({
  name: { type: String, required: true },
  image: { type: String, default: '' },
  url: { type: String, default: '' },
  position: { type: String, default: 'homepage_banner' },
  active: { type: Boolean, default: true },
  clicks: { type: Number, default: 0 },
  impressions: { type: Number, default: 0 },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
}, { timestamps: true });

export const Sponsor = mongoose.models.Sponsor || mongoose.model('Sponsor', SponsorSchema);

const AdminSchema = new Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false }, // select:false means password not included by default
  name: { type: String, default: '', trim: true },
  role: { type: String, enum: ['superadmin', 'admin', 'editor', 'reviewer'], default: 'admin' },
  active: { type: Boolean, default: true },
  lastLogin: { type: Date },
  lastLoginIp: { type: String, default: '' },
  lastLoginUA: { type: String, default: '' },
  failedAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date },
  passwordChangedAt: { type: Date, default: Date.now },
}, { timestamps: true });

AdminSchema.index({ email: 1 }, { unique: true });
AdminSchema.index({ role: 1 });

export const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);

const ActivityLogSchema = new Schema({
  adminId: { type: Schema.Types.ObjectId, ref: 'Admin' },
  action: { type: String, required: true },
  details: { type: String, default: '' },
  entityType: { type: String, default: '' },
  entityId: { type: String, default: '' },
}, { timestamps: true });

ActivityLogSchema.index({ createdAt: -1 }, { expireAfterSeconds: 7776000 });

export const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema);