import mongoose, { Schema, Document, Types } from 'mongoose';

const PhoneImageSchema = new Schema({
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true, index: true },
  url: { type: String, required: true },
  altText: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

PhoneImageSchema.index({ phoneId: 1, sortOrder: 1 });

export const PhoneImage = mongoose.models.PhoneImage || mongoose.model('PhoneImage', PhoneImageSchema);

const PhoneBenchmarkSchema = new Schema({
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true },
  antutu: { type: Number, default: 0 },
  geekbenchSingle: { type: Number, default: 0 },
  geekbenchMulti: { type: Number, default: 0 },
  gamingScore: { type: Number, default: 0 },
  pubgFps: { type: String, default: '' },
  codMobileFps: { type: String, default: '' },
  genshinFps: { type: String, default: '' },
  videoPlayback: { type: String, default: '' },
  gamingBattery: { type: String, default: '' },
  browsingBattery: { type: String, default: '' },
}, { timestamps: true });

PhoneBenchmarkSchema.index({ phoneId: 1 }, { unique: true });

export const PhoneBenchmark = mongoose.models.PhoneBenchmark || mongoose.model('PhoneBenchmark', PhoneBenchmarkSchema);

const ReviewSchema = new Schema({
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true, index: true },
  rating: { type: Number, default: 0 },
  pros: { type: String, default: '' },
  cons: { type: String, default: '' },
  content: { type: String, default: '' },
  author: { type: String, default: '' },
  published: { type: Boolean, default: false },
}, { timestamps: true });

ReviewSchema.index({ phoneId: 1, published: 1 });

export const Review = mongoose.models.Review || mongoose.model('Review', ReviewSchema);

const PhonePriceSchema = new Schema({
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true, index: true },
  storeName: { type: String, default: '' },
  price: { type: Number, default: 0 },
  url: { type: String, default: '' },
  inStock: { type: Boolean, default: true },
  currency: { type: String, default: 'PKR' },
  sourceUrl: { type: String, default: '' },
  warrantyType: { type: String, default: '' },
  ptaStatus: { type: String, default: '' },
  lastChecked: { type: Date, default: null },
  validityStatus: { type: String, enum: ['valid', 'stale', 'unknown'], default: 'unknown' },
}, { timestamps: true });

PhonePriceSchema.index({ phoneId: 1, storeName: 1 }, { unique: true });

export const PhonePrice = mongoose.models.PhonePrice || mongoose.model('PhonePrice', PhonePriceSchema);

// ─── PriceHistory ──────────────────────────────────────────────────────────────
const PriceHistorySchema = new Schema({
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true, index: true },
  storeName: { type: String, default: null },
  price: { type: Number, required: true },
  recordedAt: { type: Date, default: () => new Date() },
}, { timestamps: true });

PriceHistorySchema.index({ phoneId: 1, storeName: 1 });
PriceHistorySchema.index({ phoneId: 1, recordedAt: -1 });

export const PriceHistory = mongoose.models.PriceHistory || mongoose.model('PriceHistory', PriceHistorySchema);