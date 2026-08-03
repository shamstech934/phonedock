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
    incompleteSpecs: { type: Number, default: 0 },
    staleSpecs: { type: Number, default: 0 },
    unverifiedImages: { type: Number, default: 0 },
    discountedPhones: { type: Number, default: 0 },
    discontinuedPhones: { type: Number, default: 0 },
    upcomingPhones: { type: Number, default: 0 },
    ptaApprovedPhones: { type: Number, default: 0 },
    nonPtaPhones: { type: Number, default: 0 },
    unknownPtaPhones: { type: Number, default: 0 },
    verifiedPriceListings: { type: Number, default: 0 },
    failedPriceListings: { type: Number, default: 0 },
    stalePriceListings: { type: Number, default: 0 },
    priceDropsToday: { type: Number, default: 0 },
    priceIncreasesToday: { type: Number, default: 0 },
    totalPhones: { type: Number, default: 0 },
    publishedPhones: { type: Number, default: 0 },
  },
  trackers: [{
    key: { type: String, required: true },
    title: { type: String, required: true },
    status: { type: String, enum: ['healthy', 'attention', 'critical', 'not_configured'], default: 'healthy' },
    count: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    details: { type: String, default: '' },
    actionUrl: { type: String, default: '' },
    metrics: { type: Schema.Types.Mixed, default: {} },
  }],
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
