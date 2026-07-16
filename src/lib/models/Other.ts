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
  password: { type: String, required: true, select: false },
  name: { type: String, default: '', trim: true },
  role: { type: String, enum: ['superadmin', 'admin', 'editor', 'reviewer'], default: 'admin' },
  active: { type: Boolean, default: true },
  lastLogin: { type: Date },
  lastLoginIp: { type: String, default: '' },
  lastLoginUA: { type: String, default: '' },
  failedAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date },
  passwordChangedAt: { type: Date, default: Date.now },
  // Session version revocation (serverless-safe) — replaces revokedSessions array
  // Every token includes sessionVersion at signing time. On password change,
  // disable, or revoke-all, this is incremented. Old tokens fail the version check.
  sessionVersion: { type: Number, default: 0 },
  emailVerified: { type: Boolean, default: false },
  // Password reset token (for forgot-password flow) — stored as hash
  resetTokenHash: { type: String, select: false },
  resetTokenExpires: { type: Date, select: false },
}, { timestamps: true });

AdminSchema.index({ email: 1 }, { unique: true });
AdminSchema.index({ role: 1 });

export const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);

// Rate limit collection for persistent IP rate limiting (serverless-safe)
const RateLimitSchema = new Schema({
  key: { type: String, required: true },
  count: { type: Number, default: 1 },
  expiresAt: { type: Date, required: true },
}, { timestamps: false });

// TTL index: auto-delete expired entries after 5 minutes
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, background: true });
RateLimitSchema.index({ key: 1 }, { unique: true, background: true });

export const RateLimit = mongoose.models.RateLimit || mongoose.model('RateLimit', RateLimitSchema);

const ActivityLogSchema = new Schema({
  adminId: { type: Schema.Types.ObjectId, ref: 'Admin' },
  action: { type: String, required: true },
  details: { type: String, default: '' },
  entityType: { type: String, default: '' },
  entityId: { type: String, default: '' },
}, { timestamps: true });

ActivityLogSchema.index({ createdAt: -1 }, { expireAfterSeconds: 7776000 });

export const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema);

// ─── UserReview (Phase 4) ──────────────────────────────────────────────────
const UserReviewSchema = new Schema({
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'flagged'], default: 'pending' },
  spamFlags: { type: [String], default: [] },
}, { timestamps: true });

UserReviewSchema.index({ phoneId: 1, status: 1 });
UserReviewSchema.index({ status: 1, createdAt: -1 });

export const UserReview = mongoose.models.UserReview || mongoose.model('UserReview', UserReviewSchema);

// ─── PriceAlert (Phase 6) ──────────────────────────────────────────────────
const PriceAlertSchema = new Schema({
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  status: { type: String, enum: ['pending', 'confirmed', 'unsubscribed'], default: 'pending', index: true },
  confirmationTokenHash: { type: String, default: '' },
  confirmationTokenExpires: { type: Date, default: null },
  confirmedAt: { type: Date, default: null },
  targetPrice: { type: Number, default: 0 },
  notified: { type: Boolean, default: false },
  unsubscribedAt: { type: Date, default: null },
}, { timestamps: true });

PriceAlertSchema.index({ phoneId: 1, email: 1 });
PriceAlertSchema.index({ notified: 1, createdAt: -1 });
PriceAlertSchema.index({ confirmationTokenHash: 1 }, { sparse: true });

export const PriceAlert = mongoose.models.PriceAlert || mongoose.model('PriceAlert', PriceAlertSchema);