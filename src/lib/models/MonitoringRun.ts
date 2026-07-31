import mongoose, { Schema } from 'mongoose';

const MonitoringRunSchema = new Schema({
  trigger: { type: String, enum: ['manual', 'cron'], default: 'manual', index: true },
  status: { type: String, enum: ['running', 'completed', 'completed_with_warnings', 'failed'], default: 'running', index: true },
  startedAt: { type: Date, default: Date.now, index: true },
  completedAt: { type: Date, default: null },
  durationMs: { type: Number, default: 0 },
  summary: {
    feedsConfigured: { type: Number, default: 0 },
    feedsScanned: { type: Number, default: 0 },
    newsImported: { type: Number, default: 0 },
    launchCandidatesCreated: { type: Number, default: 0 },
    pendingLaunchCandidates: { type: Number, default: 0 },
    staleDraftPhones: { type: Number, default: 0 },
    missingSpecs: { type: Number, default: 0 },
    missingImages: { type: Number, default: 0 },
    missingPrices: { type: Number, default: 0 },
    openDataQualityIssues: { type: Number, default: 0 },
  },
  alerts: [{
    code: { type: String, required: true },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
    title: { type: String, required: true },
    details: { type: String, default: '' },
    count: { type: Number, default: 0 },
  }],
  errors: { type: [String], default: [] },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

MonitoringRunSchema.index({ createdAt: -1 });
MonitoringRunSchema.index({ status: 1, createdAt: -1 });

export const MonitoringRun = mongoose.models.MonitoringRun || mongoose.model('MonitoringRun', MonitoringRunSchema);
