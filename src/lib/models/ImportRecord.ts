import mongoose, { Schema } from 'mongoose';

export interface IImportRecord {
  importId: string;
  rowNumber: number;
  payload: Record<string, unknown>;
  checksum: string;
  createdAt: Date;
  updatedAt: Date;
}

const ImportRecordSchema = new Schema<IImportRecord>({
  importId: { type: String, required: true, index: true },
  rowNumber: { type: Number, required: true, min: 1 },
  payload: { type: Schema.Types.Mixed, required: true },
  checksum: { type: String, required: true },
}, { timestamps: true });

ImportRecordSchema.index({ importId: 1, rowNumber: 1 }, { unique: true });

export const ImportRecord = mongoose.models.ImportRecord || mongoose.model<IImportRecord>('ImportRecord', ImportRecordSchema);
