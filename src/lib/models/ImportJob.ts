import mongoose, { Schema } from 'mongoose';

const IMPORT_JOB_STATUSES = [
  'uploaded', 'parsing', 'validating', 'ready', 'queued',
  'processing', 'paused', 'completed', 'completed_with_errors',
  'failed', 'rolling_back', 'rolled_back', 'cancelled',
] as const;

const DUPLICATE_MODES = ['skip', 'update', 'replace', 'create_variant', 'review'] as const;

export type ImportJobStatus = typeof IMPORT_JOB_STATUSES[number];
export type DuplicateMode = typeof DUPLICATE_MODES[number];

export interface IImportJob {
  importId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileHash: string;
  totalRecords: number;
  processedRecords: number;
  createdRecords: number;
  updatedRecords: number;
  replacedRecords: number;
  skippedRecords: number;
  failedRecords: number;
  duplicateMode: DuplicateMode;
  status: ImportJobStatus;
  currentBatch: number;
  totalBatches: number;
  batchSize: number;
  publishMode: 'immediate' | 'review';
  dryRun: boolean;
  createMissingBrands: boolean;
  startedAt: Date | null;
  completedAt: Date | null;
  createdBy: mongoose.Types.ObjectId;
  errorSummary?: string;
  rollbackStatus?: string;
  buildVersion?: string;
  // Preview data stored temporarily
  previewData?: Record<string, unknown>[];
  previewStats?: {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    warnings: number;
    recognizedFields: string[];
    ignoredFields: string[];
    missingFields: string[];
    duplicateEstimate: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ImportJobSchema = new Schema<IImportJob>({
  importId: { type: String, required: true, unique: true },
  fileName: { type: String, required: true },
  fileType: { type: String, enum: ['json', 'csv', 'xlsx', 'zip'], required: true },
  fileSize: { type: Number, required: true },
  fileHash: { type: String, required: true },
  totalRecords: { type: Number, default: 0 },
  processedRecords: { type: Number, default: 0 },
  createdRecords: { type: Number, default: 0 },
  updatedRecords: { type: Number, default: 0 },
  replacedRecords: { type: Number, default: 0 },
  skippedRecords: { type: Number, default: 0 },
  failedRecords: { type: Number, default: 0 },
  duplicateMode: { type: String, enum: [...DUPLICATE_MODES], default: 'skip' },
  status: { type: String, enum: [...IMPORT_JOB_STATUSES], default: 'uploaded', index: true },
  currentBatch: { type: Number, default: 0 },
  totalBatches: { type: Number, default: 0 },
  batchSize: { type: Number, default: 200, min: 50, max: 500 },
  publishMode: { type: String, enum: ['immediate', 'review'], default: 'immediate' },
  dryRun: { type: Boolean, default: false },
  createMissingBrands: { type: Boolean, default: true },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
  errorSummary: { type: String, default: '' },
  rollbackStatus: { type: String, default: '' },
  buildVersion: { type: String, default: '' },
  previewData: [{ type: Schema.Types.Mixed }],
  previewStats: {
    totalRecords: Number,
    validRecords: Number,
    invalidRecords: Number,
    warnings: Number,
    recognizedFields: [String],
    ignoredFields: [String],
    missingFields: [String],
    duplicateEstimate: Number,
  },
}, { timestamps: true });

ImportJobSchema.index({ status: 1, createdAt: -1 });
ImportJobSchema.index({ createdBy: 1, createdAt: -1 });

export const ImportJob = mongoose.models.ImportJob || mongoose.model<IImportJob>('ImportJob', ImportJobSchema);
