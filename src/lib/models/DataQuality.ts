import mongoose, { Schema } from 'mongoose';

// ─── DataQualityIssue ──────────────────────────────────────────────
const DataQualityIssueSchema = new Schema({
  // Stable issue key — prevents duplicate issue records for the same unresolved problem
  issueKey: { type: String, required: true, index: true },
  entityType: { type: String, required: true, enum: ['phone', 'brand', 'phone_specs', 'phone_image', 'phone_price', 'phone_benchmark', 'review', 'video', 'import', 'price_source', 'retail_listing'], index: true },
  entityId: { type: String, required: true, index: true },
  issueType: { type: String, required: true, index: true },
  severity: { type: String, enum: ['critical', 'high', 'medium', 'low', 'info'], required: true, index: true },
  field: { type: String, default: '' },
  currentValue: { type: Schema.Types.Mixed, default: null },
  suggestedValue: { type: Schema.Types.Mixed, default: null },
  source: { type: String, default: '' },
  confidence: { type: Number, default: 0, min: 0, max: 1 },
  status: { type: String, enum: ['open', 'ignored', 'resolved', 'auto_fixed', 'needs_review', 'false_positive'], default: 'open', index: true },
  detectedAt: { type: Date, default: () => new Date(), index: true },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  resolution: { type: String, default: '' },
  importId: { type: String, default: null, index: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

// Unique index: only one open/ignored/needs_review issue per issueKey
DataQualityIssueSchema.index({ issueKey: 1, status: { $in: ['open', 'ignored', 'needs_review'] } }, { unique: true, sparse: true });
DataQualityIssueSchema.index({ entityType: 1, entityId: 1, status: 1 });
DataQualityIssueSchema.index({ issueType: 1, status: 1 });

export const DataQualityIssue = mongoose.models.DataQualityIssue || mongoose.model('DataQualityIssue', DataQualityIssueSchema);

// ─── ScanJob ──────────────────────────────────────────────────────
const ScanJobSchema = new Schema({
  scanId: { type: String, required: true, unique: true },
  type: { type: String, required: true, enum: ['full', 'incremental', 'entity', 'import', 'manual'] },
  status: { type: String, enum: ['queued', 'running', 'completed', 'completed_with_errors', 'failed', 'cancelled'], default: 'queued', index: true },
  total: { type: Number, default: 0 },
  processed: { type: Number, default: 0 },
  issuesFound: { type: Number, default: 0 },
  issuesCreated: { type: Number, default: 0 },
  issuesResolved: { type: Number, default: 0 },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  // For entity-specific scans
  entityType: { type: String, default: '' },
  entityIds: { type: [String], default: [] },
  // For import-specific scans
  importId: { type: String, default: '' },
  // Batch processing state (persisted for resume)
  currentBatch: { type: Number, default: 0 },
  batchSize: { type: Number, default: 100 },
  lastProcessedId: { type: String, default: '' },
  errorSummary: { type: String, default: '' },
  dryRun: { type: Boolean, default: false },
  rules: { type: [String], default: [] }, // which rules to run (empty = all)
}, { timestamps: true });

ScanJobSchema.index({ status: 1, createdAt: -1 });
ScanJobSchema.index({ createdBy: 1, createdAt: -1 });

export const ScanJob = mongoose.models.ScanJob || mongoose.model('ScanJob', ScanJobSchema);