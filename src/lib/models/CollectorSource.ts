import mongoose, { Schema } from 'mongoose';

const CollectorSourceSchema = new Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['json_url', 'csv_url', 'api', 'xml_feed', 'rss_feed', 'manufacturer', 'manual_url', 'file_upload'],
    required: true,
  },
  enabled: { type: Boolean, default: true },
  endpoint: { type: String, default: '' },
  apiKeyEnvVar: { type: String, default: '' },
  headers: { type: Map, of: String, default: {} },
  allowedDomains: [{ type: String }],
  timeoutMs: { type: Number, default: 30000, min: 1000, max: 60000 },
  maxResponseBytes: { type: Number, default: 5242880, min: 1024, max: 10485760 },
  brandFilter: [{ type: String }],
  countryFilter: { type: String, default: '' },
  region: { type: String, default: '' },
  syncFrequencyHours: { type: Number, default: 0 },
  dataPath: { type: String, default: '' },
  mappingRules: { type: Map, of: String, default: {} },
  defaultValues: { type: Map, of: Schema.Types.Mixed, default: {} },
  pollingSchedule: { type: String, default: 'manual' },
  lastSuccessfulSyncAt: { type: Date },
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
CollectorSourceSchema.index({ name: 1 }, { unique: true });

export const CollectorSource = mongoose.models.CollectorSource || mongoose.model('CollectorSource', CollectorSourceSchema);
