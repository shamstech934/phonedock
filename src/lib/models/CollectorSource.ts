import mongoose, { Schema } from 'mongoose';

const CollectorSourceSchema = new Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['json_url', 'csv_url', 'api', 'manufacturer', 'manual_url', 'file_upload'],
    required: true,
  },
  enabled: { type: Boolean, default: true },
  endpoint: { type: String, default: '' },
  apiKeyEnvVar: { type: String, default: '' },
  headers: { type: Map, of: String, default: {} },
  brandFilter: [{ type: String }],
  countryFilter: { type: String, default: '' },
  region: { type: String, default: '' },
  syncFrequencyHours: { type: Number, default: 0 },
  dataPath: { type: String, default: '' },
  mappingRules: { type: Map, of: String, default: {} },
  paginationPageSize: { type: Number, default: 100 },
  paginationMaxPages: { type: Number, default: 50 },
  paginationPageParam: { type: String, default: 'page' },
  lastSyncAt: { type: Date },
  lastSyncStatus: { type: String, enum: ['success', 'partial', 'failed'], default: '' },
  lastError: { type: String, default: '' },
  totalCollected: { type: Number, default: 0 },
  totalFailed: { type: Number, default: 0 },
  reliabilityScore: { type: Number, default: 1.0, min: 0, max: 1 },
  notes: { type: String, default: '' },
}, { timestamps: true });

CollectorSourceSchema.index({ enabled: 1 });
CollectorSourceSchema.index({ type: 1 });

export const CollectorSource = mongoose.models.CollectorSource || mongoose.model('CollectorSource', CollectorSourceSchema);