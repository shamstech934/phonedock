import mongoose, { Schema } from 'mongoose';

const ImportHistorySchema = new Schema({
  filename: { type: String, required: true },
  fileType: { type: String, enum: ['json', 'csv', 'xlsx'], required: true },
  totalRecords: { type: Number, required: true },
  inserted: { type: Number, default: 0 },
  updated: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  errorRecords: [{
    row: { type: Number },
    model: { type: String },
    error: { type: String },
  }],
  status: {
    type: String,
    enum: ['completed', 'partial', 'failed', 'rolled_back'],
    default: 'completed',
  },
  duration: { type: Number, default: 0 },
  batchSize: { type: Number, default: 100 },
}, { timestamps: true });

ImportHistorySchema.index({ createdAt: -1 });
ImportHistorySchema.index({ status: 1 });

export const ImportHistory = mongoose.models.ImportHistory || mongoose.model('ImportHistory', ImportHistorySchema);