import mongoose, { Schema } from 'mongoose';
import { PRICE_SOURCE_TYPES } from '@/lib/price-source-types';

// ─── PriceSource ────────────────────────────────────────────────────────
const PriceSourceSchema = new Schema({
  name: { type: String, required: true },
  sourceType: { type: String, enum: PRICE_SOURCE_TYPES, default: 'retailer' },
  enabled: { type: Boolean, default: true },
  trusted: { type: Boolean, default: false },
  baseUrl: { type: String, default: '' },
  verificationUrl: { type: String, default: '' },
  discoveryEnabled: { type: Boolean, default: false },
  discoveryMode: { type: String, enum: ['manual', 'sitemap', 'catalog', 'feed', 'api'], default: 'manual' },
  catalogUrls: { type: [String], default: [] },
  sitemapUrls: { type: [String], default: [] },
  feedUrl: { type: String, default: '' },
  syncFrequency: { type: String, enum: ['manual', 'hourly', 'daily', 'weekly'], default: 'daily' },
  lastDiscoveryAt: { type: Date, default: null },
  lastDiscoveryCount: { type: Number, default: 0 },
  productsFound: { type: Number, default: 0 },
  productsAdded: { type: Number, default: 0 },
  productsUpdated: { type: Number, default: 0 },
  productsRemoved: { type: Number, default: 0 },
  allowedDomains: { type: [String], default: [] },
  priority: { type: Number, default: 0 },
  lastCheckedAt: { type: Date, default: null },
  lastSuccessAt: { type: Date, default: null },
  failureCount: { type: Number, default: 0 },
  nextRetryAt: { type: Date, default: null },
  lastError: { type: String, default: '' },
  status: { type: String, enum: ['active', 'paused', 'failed'], default: 'active' },
  notes: { type: String, default: '' },
}, { timestamps: true });

PriceSourceSchema.index({ name: 1 }, { unique: true });
PriceSourceSchema.index({ sourceType: 1 });
PriceSourceSchema.index({ enabled: 1, status: 1 });
PriceSourceSchema.index({ enabled: 1, status: 1, nextRetryAt: 1 });
PriceSourceSchema.index({ priority: -1 });
PriceSourceSchema.index({ enabled: 1, trusted: 1, status: 1, discoveryEnabled: 1, syncFrequency: 1, lastDiscoveryAt: 1 });

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
  pendingSourcePrice: { type: Number, default: 0 },
  pendingDetectedAt: { type: Date, default: null },
  availability: { type: String, enum: ['available', 'unavailable', 'unknown'], default: 'unknown' },
  lastCheckedAt: { type: Date, default: null },
  lastChangedAt: { type: Date, default: null },
  lastSuccessAt: { type: Date, default: null },
  failureCount: { type: Number, default: 0 },
  nextRetryAt: { type: Date, default: null },
  lastError: { type: String, default: '' },
  extractionMethod: { type: String, enum: ['json-ld', 'meta', 'data-attribute', 'visible-text', ''], default: '' },
  extractionConfidence: { type: Number, default: 0 },
  enabled: { type: Boolean, default: true },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected', 'failed'], default: 'pending' },
  discoveryOrigin: { type: String, enum: ['manual', 'collector', 'catalog', 'legacy', 'phone'], default: 'manual' },
  collectorRecordId: { type: Schema.Types.ObjectId, ref: 'CollectedPhone', default: null },
  matchStrategy: { type: String, enum: ['manual', 'direct_approval', 'imported', 'exact_duplicate', 'url_model'], default: 'manual' },
  matchConfidence: { type: Number, default: 0, min: 0, max: 100 },
}, { timestamps: true });

PhoneRetailListingSchema.index({ phoneId: 1, sourceId: 1 });
PhoneRetailListingSchema.index({ phoneId: 1, enabled: 1 });
PhoneRetailListingSchema.index({ phoneId: 1, verificationStatus: 1, availability: 1, currentSourcePrice: 1 });
PhoneRetailListingSchema.index({ sourceId: 1, enabled: 1 });
PhoneRetailListingSchema.index({ verificationStatus: 1 });
PhoneRetailListingSchema.index({ enabled: 1, verificationStatus: 1, lastCheckedAt: 1 });
PhoneRetailListingSchema.index({ failureCount: -1, lastCheckedAt: 1 });
PhoneRetailListingSchema.index({ enabled: 1, verificationStatus: 1, nextRetryAt: 1 });
PhoneRetailListingSchema.index({ externalProductId: 1 });
PhoneRetailListingSchema.index({ collectorRecordId: 1 });
PhoneRetailListingSchema.index({ verificationStatus: 1, discoveryOrigin: 1, matchStrategy: 1, matchConfidence: 1, lastCheckedAt: 1 });
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
