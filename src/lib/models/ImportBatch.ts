import mongoose, { Schema } from 'mongoose';

export interface IImportBatch {
  importId: string;
  batchNumber: number;
  recordStart: number;
  recordEnd: number;
  recordCount: number;
  checksum: string;
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
  }[];
  // For rollback: track created phone IDs and field changes
  createdPhoneIds: mongoose.Types.ObjectId[];
  updatedPhoneIds: mongoose.Types.ObjectId[];
  fieldChanges: {
    phoneId: mongoose.Types.ObjectId;
    field: string;
    oldValue: unknown;
    newValue: unknown;
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
  }],
  createdPhoneIds: [{ type: Schema.Types.ObjectId, ref: 'Phone' }],
  updatedPhoneIds: [{ type: Schema.Types.ObjectId, ref: 'Phone' }],
  fieldChanges: [{
    phoneId: { type: Schema.Types.ObjectId, ref: 'Phone' },
    field: String,
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
  }],
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

// Compound unique: same batch for same import must not duplicate
ImportBatchSchema.index({ importId: 1, batchNumber: 1 }, { unique: true });
ImportBatchSchema.index({ status: 1, createdAt: -1 });

export const ImportBatch = mongoose.models.ImportBatch || mongoose.model<IImportBatch>('ImportBatch', ImportBatchSchema);