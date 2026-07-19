import mongoose, { Schema } from 'mongoose';

export interface IImportBatch {
  importId: string;
  batchNumber: number;
  recordStart: number;
  recordEnd: number;
  recordCount: number;
  checksum: string;
  // FIX #3: Track whether this was a dry-run or real execution
  executionMode: 'dry_run' | 'real';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  attemptCount: number;
  created: number;
  updated: number;
  replaced: number;
  skipped: number;
  failed: number;
  errors: {
    rowNumber: number;
    brand?: string;
    model?: string;
    field?: string;
    originalValue?: string;
    errorCode: string;
    errorMessage: string;
    phoneId?: string;
  }[];
  // For rollback: track created phone IDs and field changes
  createdPhoneIds: mongoose.Types.ObjectId[];
  updatedPhoneIds: mongoose.Types.ObjectId[];
  // FIX #8: Track which collection the change applies to
  fieldChanges: {
    phoneId: mongoose.Types.ObjectId;
    collection: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  // FIX #8: Track PhoneSpecs changes for rollback
  specsChanges: {
    phoneId: mongoose.Types.ObjectId;
    collection: string;
    changeType: 'created' | 'updated';
    beforeFields?: Record<string, string>;
    afterFields?: Record<string, string>;
    fields?: Record<string, string>;
  }[];
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ImportBatchSchema = new Schema<IImportBatch>({
  importId: { type: String, required: true, index: true },
  batchNumber: { type: Number, required: true },
  recordStart: { type: Number, required: true },
  recordEnd: { type: Number, required: true },
  recordCount: { type: Number, required: true },
  checksum: { type: String, required: true },
  // FIX #3: executionMode distinguishes dry-run from real batches
  executionMode: { type: String, enum: ['dry_run', 'real'], default: 'real' },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'retrying'], default: 'pending', index: true },
  attemptCount: { type: Number, default: 0 },
  created: { type: Number, default: 0 },
  updated: { type: Number, default: 0 },
  replaced: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  errors: [{
    rowNumber: Number,
    brand: String,
    model: String,
    field: String,
    originalValue: String,
    errorCode: String,
    errorMessage: String,
    phoneId: String,
  }],
  createdPhoneIds: [{ type: Schema.Types.ObjectId, ref: 'Phone' }],
  updatedPhoneIds: [{ type: Schema.Types.ObjectId, ref: 'Phone' }],
  fieldChanges: [{
    phoneId: { type: Schema.Types.ObjectId, ref: 'Phone' },
    collection: { type: String, default: 'Phone' },
    field: String,
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
  }],
  // FIX #8: Track PhoneSpecs changes for complete rollback
  specsChanges: [{
    phoneId: { type: Schema.Types.ObjectId, ref: 'Phone' },
    collection: { type: String, default: 'PhoneSpecs' },
    changeType: { type: String, enum: ['created', 'updated'] },
    beforeFields: { type: Schema.Types.Mixed, default: {} },
    afterFields: { type: Schema.Types.Mixed, default: {} },
    fields: { type: Schema.Types.Mixed, default: {} },
  }],
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

// Compound unique: same batch for same import must not duplicate
ImportBatchSchema.index({ importId: 1, batchNumber: 1 }, { unique: true });
ImportBatchSchema.index({ status: 1, createdAt: -1 });
// FIX #10: Index for completion queries
ImportBatchSchema.index({ importId: 1, status: 1 });

export const ImportBatch = mongoose.models.ImportBatch || mongoose.model<IImportBatch>('ImportBatch', ImportBatchSchema);