import mongoose, { Schema } from 'mongoose';

const PriceIntelligenceSignalSchema = new Schema({
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true, index: true },
  type: { type: String, required: true, index: true },
  status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open', index: true },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning', index: true },
  title: { type: String, required: true },
  details: { type: String, default: '' },
  recommendedPrice: { type: Number, default: 0 },
  sourceId: { type: Schema.Types.ObjectId, ref: 'PriceSource', default: null },
  sourceUrl: { type: String, default: '' },
  evidence: { type: Schema.Types.Mixed, default: {} },
  detectedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now, index: true },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  resolutionNotes: { type: String, default: '' },
}, { timestamps: true });
PriceIntelligenceSignalSchema.index({ phoneId: 1, type: 1 }, { unique: true });
PriceIntelligenceSignalSchema.index({ status: 1, severity: 1, lastSeenAt: -1 });
export const PriceIntelligenceSignal = mongoose.models.PriceIntelligenceSignal || mongoose.model('PriceIntelligenceSignal', PriceIntelligenceSignalSchema);
