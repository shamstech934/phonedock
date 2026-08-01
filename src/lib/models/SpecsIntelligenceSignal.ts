import mongoose, { Schema } from 'mongoose';

const SpecsIntelligenceSignalSchema = new Schema({
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true, index: true },
  field: { type: String, required: true, index: true },
  status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open', index: true },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning', index: true },
  currentValue: { type: String, default: '' },
  recommendedValue: { type: String, default: '' },
  sourceName: { type: String, default: '' },
  sourceUrl: { type: String, default: '' },
  confidence: { type: Number, min: 0, max: 100, default: 0 },
  evidence: { type: Schema.Types.Mixed, default: {} },
  detectedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now, index: true },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  resolutionNotes: { type: String, default: '' },
}, { timestamps: true });
SpecsIntelligenceSignalSchema.index({ phoneId: 1, field: 1 }, { unique: true });
SpecsIntelligenceSignalSchema.index({ status: 1, severity: 1, lastSeenAt: -1 });
export const SpecsIntelligenceSignal = mongoose.models.SpecsIntelligenceSignal || mongoose.model('SpecsIntelligenceSignal', SpecsIntelligenceSignalSchema);
