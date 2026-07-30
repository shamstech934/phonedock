import mongoose, { Schema } from 'mongoose';

// ─── PriceSource ────────────────────────────────────────────────────────
const PriceSourceSchema = new Schema({
  name: { type: String, required: true },
  sourceType: { type: String, enum: ['retailer', 'marketplace', 'official'], default: 'retailer' },
  enabled: { type: Boolean, default: true },
  trusted: { type: Boolean, default: false },
  baseUrl: { type: String, default: '' },
  allowedDomains: { type: [String], default: [] },
  priority: { type: Number, default: 0 },
  lastCheckedAt: { type: Date, default: null },
  lastSuccessAt: { type: Date, default: null },
  failureCount: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'paused', 'failed'], default: 'active' },
  notes: { type: String, default: '' },
}, { timestamps: true });

PriceSourceSchema.index({ name: 1 }, { unique: true });
PriceSourceSchema.index({ sourceType: 1 });
PriceSourceSchema.index({ enabled: 1, status: 1 });
PriceSourceSchema.index({ priority: -1 });

export const PriceSource = mongoose.models.PriceSource || mongoose.model('PriceSource', PriceSourceSchema);

// ─── PhoneRetailListing ─────────────────────────────────────────────────
const PhoneRetailListingSchema = new Schema({
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true, index: true },
  variantId: { type: Schema.Types.ObjectId, ref: 'Phone' },
  sourceId: { type: Schema.Types.ObjectId, ref: 'PriceSource', required: true, index: true },
  productUrl: { type: String, default: '' },
  externalProductId: { type: String, default: '' },
  sourceTitle: { type: String, default: '' },
  ram: { type: String, default: '' },
  storage: { type: String, default: '' },
  ptaStatus: { type: String, default: '' },
  warrantyType: { type: String, default: '' },
  currentSourcePrice: { type: Number, default: 0 },
  previousSourcePrice: { type: Number, default: 0 },
  availability: { type: String, enum: ['available', 'unavailable', 'unknown'], default: 'unknown' },
  lastCheckedAt: { type: Date, default: null },
  lastChangedAt: { type: Date, default: null },
  enabled: { type: Boolean, default: true },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected', 'failed'], default: 'pending' },
}, { timestamps: true });

PhoneRetailListingSchema.index({ phoneId: 1, sourceId: 1 });
PhoneRetailListingSchema.index({ phoneId: 1, enabled: 1 });
PhoneRetailListingSchema.index({ sourceId: 1, enabled: 1 });
PhoneRetailListingSchema.index({ verificationStatus: 1 });
PhoneRetailListingSchema.index({ externalProductId: 1 });
PhoneRetailListingSchema.index({ sourceId: 1, productUrl: 1 }, {
  unique: true,
  partialFilterExpression: { productUrl: { $type: 'string', $gt: '' } },
});

export const PhoneRetailListing = mongoose.models.PhoneRetailListing || mongoose.model('PhoneRetailListing', PhoneRetailListingSchema);

const PriceMatchCandidateSchema = new Schema({
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true, index: true },
  sourceUrl: { type: String, required: true },
  hostname: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'resolved', 'ignored'], default: 'pending', index: true },
  reason: { type: String, default: 'No trusted source covers this hostname.' },
  resolvedSourceId: { type: Schema.Types.ObjectId, ref: 'PriceSource', default: null },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true });

PriceMatchCandidateSchema.index({ phoneId: 1, sourceUrl: 1 }, { unique: true });
PriceMatchCandidateSchema.index({ status: 1, hostname: 1, createdAt: -1 });

export const PriceMatchCandidate = mongoose.models.PriceMatchCandidate
  || mongoose.model('PriceMatchCandidate', PriceMatchCandidateSchema);

// ─── PriceTrackerHistory ────────────────────────────────────────────────
const PriceTrackerHistorySchema = new Schema({
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true, index: true },
  variantId: { type: Schema.Types.ObjectId, ref: 'Phone' },
  oldPrice: { type: Number, default: 0 },
  newPrice: { type: Number, default: 0 },
  difference: { type: Number, default: 0 },
  percentageChange: { type: Number, default: 0 },
  changeType: { type: String, enum: ['increase', 'decrease', 'unchanged', 'correction'], default: 'unchanged' },
  sourceType: { type: String, enum: ['manual', 'retailer', 'correction'], default: 'manual' },
  sourceId: { type: Schema.Types.ObjectId, ref: 'PriceSource' },
  sourceUrl: { type: String, default: '' },
  changedByAdminId: { type: Schema.Types.ObjectId, ref: 'Admin' },
  approvedByAdminId: { type: Schema.Types.ObjectId, ref: 'Admin' },
  capturedAt: { type: Date, default: Date.now },
  verificationStatus: { type: String, enum: ['confirmed', 'pending', 'rejected'], default: 'confirmed' },
}, { timestamps: true });

PriceTrackerHistorySchema.index({ phoneId: 1, capturedAt: -1 });
PriceTrackerHistorySchema.index({ phoneId: 1, changeType: 1 });
PriceTrackerHistorySchema.index({ sourceType: 1 });
PriceTrackerHistorySchema.index({ verificationStatus: 1 });
PriceTrackerHistorySchema.index({ capturedAt: -1 });

export const PriceTrackerHistory = mongoose.models.PriceTrackerHistory || mongoose.model('PriceTrackerHistory', PriceTrackerHistorySchema);
