import mongoose, { Schema } from 'mongoose';

const YouTubeIntelligenceSignalSchema = new Schema({
  videoId: { type: Schema.Types.ObjectId, ref: 'Video', required: true, index: true },
  type: { type: String, required: true, index: true },
  status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open', index: true },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning', index: true },
  recommendedPhoneId: { type: Schema.Types.ObjectId, ref: 'Phone', default: null },
  recommendedCategory: { type: String, default: '' },
  confidence: { type: Number, min: 0, max: 100, default: 0 },
  details: { type: String, default: '' },
  evidence: { type: Schema.Types.Mixed, default: {} },
  detectedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now, index: true },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  resolutionNotes: { type: String, default: '' },
}, { timestamps: true });
YouTubeIntelligenceSignalSchema.index({ videoId: 1, type: 1 }, { unique: true });
YouTubeIntelligenceSignalSchema.index({ status: 1, severity: 1, lastSeenAt: -1 });
export const YouTubeIntelligenceSignal = mongoose.models.YouTubeIntelligenceSignal || mongoose.model('YouTubeIntelligenceSignal', YouTubeIntelligenceSignalSchema);
