import mongoose, { Schema } from 'mongoose';

const PakistanMarketSignalSchema = new Schema({
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true, index: true },
  type: {
    type: String,
    enum: [
      'missing_pta_status',
      'pta_status_available',
      'missing_pakistan_price',
      'price_available',
      'no_verified_retailer',
      'retailer_price_conflict',
      'stale_market_verification',
      'missing_pakistan_launch_date',
    ],
    required: true,
    index: true,
  },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning', index: true },
  status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open', index: true },
  title: { type: String, required: true },
  details: { type: String, default: '' },
  sourceName: { type: String, default: '' },
  sourceUrl: { type: String, default: '' },
  recommendedValue: { type: Schema.Types.Mixed, default: null },
  evidence: { type: Schema.Types.Mixed, default: {} },
  detectedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  resolutionNotes: { type: String, default: '' },
}, { timestamps: true });

PakistanMarketSignalSchema.index({ phoneId: 1, type: 1 }, { unique: true });
PakistanMarketSignalSchema.index({ status: 1, severity: 1, lastSeenAt: -1 });

export const PakistanMarketSignal = mongoose.models.PakistanMarketSignal
  || mongoose.model('PakistanMarketSignal', PakistanMarketSignalSchema);
