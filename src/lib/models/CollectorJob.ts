import mongoose, { Schema } from 'mongoose';

const CollectorJobSchema = new Schema({
  status: {
    type: String,
    enum: ['queued', 'running', 'paused', 'completed', 'partially_completed', 'failed'],
    default: 'queued',
  },
  sourceId: { type: Schema.Types.ObjectId, ref: 'CollectorSource' },
  sourceName: { type: String, default: '' },
  trigger: { type: String, enum: ['manual', 'scheduled', 'api'], default: 'manual' },
  mode: { type: String, enum: ['single_brand', 'single_source', 'all_sources', 'date_range', 'model_specific'], default: 'single_source' },
  filterBrand: { type: String, default: '' },
  filterModel: { type: String, default: '' },
  filterDateFrom: { type: String, default: '' },
  filterDateTo: { type: String, default: '' },

  // Progress
  fetched: { type: Number, default: 0 },
  normalized: { type: Number, default: 0 },
  newPhones: { type: Number, default: 0 },
  possibleUpdates: { type: Number, default: 0 },
  duplicates: { type: Number, default: 0 },
  conflictCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  totalExpected: { type: Number, default: 0 },
  currentBatch: { type: Number, default: 0 },
  totalBatches: { type: Number, default: 0 },
  lastProcessedAt: { type: Date },

  // Timing
  startedAt: { type: Date },
  completedAt: { type: Date },
  duration: { type: Number, default: 0 },

  // Error tracking
  errorLog: [{ type: String }],
  lastError: { type: String, default: '' },

  // Resume support
  resumeToken: { type: String, default: '' },
}, { timestamps: true });

CollectorJobSchema.index({ status: 1 });
CollectorJobSchema.index({ createdAt: -1 });
CollectorJobSchema.index({ sourceId: 1 });

export const CollectorJob = mongoose.models.CollectorJob || mongoose.model('CollectorJob', CollectorJobSchema);