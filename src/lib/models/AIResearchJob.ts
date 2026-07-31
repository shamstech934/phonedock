import mongoose, { Schema } from 'mongoose';

const FailureSchema = new Schema({ phoneId: { type: Schema.Types.ObjectId, ref: 'Phone' }, message: String, attempts: { type: Number, default: 1 } }, { _id: false });

const AIResearchJobSchema = new Schema({
  type: { type: String, enum: ['specs', 'images', 'prices'], required: true, index: true },
  status: { type: String, enum: ['queued', 'running', 'paused', 'completed', 'completed_with_errors', 'failed', 'cancelled'], default: 'queued', index: true },
  mode: { type: String, enum: ['lite', 'standard'], default: 'lite' },
  phoneIds: [{ type: Schema.Types.ObjectId, ref: 'Phone' }],
  cursor: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  processed: { type: Number, default: 0 },
  generated: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  providerCalls: { type: Number, default: 0 },
  maxProviderCalls: { type: Number, default: 5, min: 1, max: 50 },
  failures: [FailureSchema],
  batchSize: { type: Number, default: 1, min: 1, max: 5 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  startedAt: Date,
  completedAt: Date,
  lastRunAt: Date,
  nextRunAfter: Date,
  lockUntil: Date,
}, { timestamps: true });

AIResearchJobSchema.index({ createdAt: -1 });
AIResearchJobSchema.index({ status: 1, nextRunAfter: 1 });
export const AIResearchJob = mongoose.models.AIResearchJob || mongoose.model('AIResearchJob', AIResearchJobSchema);
