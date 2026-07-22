import mongoose, { Schema } from 'mongoose';

const AffiliateLinkSchema = new Schema({
  storeKey: { type: String, required: true, lowercase: true, trim: true, maxlength: 40 },
  storeName: { type: String, required: true, trim: true, maxlength: 80 },
  destinationUrl: { type: String, required: true, maxlength: 1000, select: false },
  trackingId: { type: String, default: '', maxlength: 120, select: false },
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', default: null, index: true },
  logo: { type: String, default: '', maxlength: 500 },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  country: { type: String, default: 'PK', uppercase: true, maxlength: 2 },
  priority: { type: Number, default: 0 },
  availability: { type: String, enum: ['in_stock', 'out_of_stock', 'preorder', 'unknown'], default: 'unknown' },
  active: { type: Boolean, default: true },
  expiresAt: { type: Date, default: null },
  clicks: { type: Number, default: 0 },
}, { timestamps: true });
AffiliateLinkSchema.index({ storeKey: 1, phoneId: 1 }, { unique: true });
AffiliateLinkSchema.index({ active: 1, availability: 1, priority: -1, expiresAt: 1 });

const AffiliateClickSchema = new Schema({
  affiliateLinkId: { type: Schema.Types.ObjectId, ref: 'AffiliateLink', required: true, index: true },
  storeKey: { type: String, required: true, index: true },
  phoneSlug: { type: String, default: '', maxlength: 160 },
  day: { type: String, required: true },
  count: { type: Number, default: 1, min: 1 },
}, { timestamps: true });
AffiliateClickSchema.index({ affiliateLinkId: 1, phoneSlug: 1, day: 1 }, { unique: true });

const ContactRequestSchema = new Schema({
  type: { type: String, enum: ['contact', 'bug', 'feature', 'business', 'affiliate', 'sponsor', 'feedback'], required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 200 },
  subject: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 3000 },
  status: { type: String, enum: ['new', 'in_progress', 'resolved', 'spam'], default: 'new', index: true },
}, { timestamps: true });
ContactRequestSchema.index({ status: 1, createdAt: -1 });

export const AffiliateLink = mongoose.models.AffiliateLink || mongoose.model('AffiliateLink', AffiliateLinkSchema);
export const AffiliateClick = mongoose.models.AffiliateClick || mongoose.model('AffiliateClick', AffiliateClickSchema);
export const ContactRequest = mongoose.models.ContactRequest || mongoose.model('ContactRequest', ContactRequestSchema);
