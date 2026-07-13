import mongoose, { Schema } from 'mongoose';

const SyncJobSchema = new Schema({
  status: {
    type: String,
    enum: ['pending', 'running', 'paused', 'completed', 'failed'],
    default: 'pending',
  },
  source: { type: String, required: true },
  totalPhones: { type: Number, default: 0 },
  processed: { type: Number, default: 0 },
  inserted: { type: Number, default: 0 },
  updated: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  errorLog: [{ type: String }],
  startedAt: { type: Date },
  completedAt: { type: Date },
}, { timestamps: true });

SyncJobSchema.index({ createdAt: -1 });
SyncJobSchema.index({ status: 1 });

export const SyncJob = mongoose.models.SyncJob || mongoose.model('SyncJob', SyncJobSchema);