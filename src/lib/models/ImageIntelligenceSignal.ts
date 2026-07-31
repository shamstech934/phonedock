import mongoose, { Schema } from 'mongoose';

const ImageIntelligenceSignalSchema = new Schema({
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true, index: true },
  imageId: { type: Schema.Types.ObjectId, ref: 'PhoneImage', default: null },
  type: { type: String, required: true, index: true },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning', index: true },
  status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open', index: true },
  title: { type: String, required: true },
  details: { type: String, default: '' },
  recommendedValue: { type: Schema.Types.Mixed, default: null },
  evidence: { type: Schema.Types.Mixed, default: {} },
  detectedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now, index: true },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  resolutionNotes: { type: String, default: '' },
}, { timestamps: true });

ImageIntelligenceSignalSchema.index({ phoneId: 1, imageId: 1, type: 1 }, { unique: true });
ImageIntelligenceSignalSchema.index({ status: 1, severity: 1, lastSeenAt: -1 });

export const ImageIntelligenceSignal = mongoose.models.ImageIntelligenceSignal || mongoose.model('ImageIntelligenceSignal', ImageIntelligenceSignalSchema);
