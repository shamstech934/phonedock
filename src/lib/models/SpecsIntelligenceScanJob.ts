import mongoose, { Schema } from 'mongoose';

const SpecsIntelligenceScanJobSchema = new Schema({
  status: { type: String, enum: ['queued', 'running', 'completed', 'failed', 'cancelled'], default: 'queued', index: true },
  cursor: { type: String, default: '' },
  totalCount: { type: Number, default: 0 },
  processedCount: { type: Number, default: 0 },
  openedCount: { type: Number, default: 0 },
  withRecommendationCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  batchSize: { type: Number, default: 25, min: 1, max: 50 },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  lastHeartbeatAt: { type: Date, default: null },
  lastError: { type: String, default: '' },
  initiatedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  leaseOwner: { type: String, default: '' },
  leaseExpiresAt: { type: Date, default: null, index: true },
}, { timestamps: true });

SpecsIntelligenceScanJobSchema.index({ status: 1, createdAt: -1 });

export const SpecsIntelligenceScanJob = mongoose.models.SpecsIntelligenceScanJob
  || mongoose.model('SpecsIntelligenceScanJob', SpecsIntelligenceScanJobSchema);
