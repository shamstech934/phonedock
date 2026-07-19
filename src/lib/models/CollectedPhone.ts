import mongoose, { Schema } from 'mongoose';

const fieldProvenanceSchema = new Schema({
  field: { type: String, required: true },
  value: { type: Schema.Types.Mixed },
  sourceName: { type: String, required: true },
  sourceUrl: { type: String, default: '' },
  collectedAt: { type: Date, required: true },
  providerId: { type: String, required: true },
  providerRecordId: { type: String, default: '' },
  confidence: { type: Number, default: 0.5, min: 0, max: 1 },
  rawHash: { type: String, default: '' },
}, { _id: false });

const conflictSchema = new Schema({
  field: { type: String, required: true },
  existingValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  existingSource: { type: String, default: '' },
  newSource: { type: String, default: '' },
  confidence: { type: Number, default: 0.5 },
}, { _id: false });

const duplicateMatchSchema = new Schema({
  type: { type: String, enum: ['exact_slug', 'brand_model', 'normalized_name', 'provider_record', 'fuzzy'], required: true },
  phoneId: { type: String, default: '' },
  modelName: { type: String, default: '' },
  brandName: { type: String, default: '' },
  slug: { type: String, default: '' },
  confidence: { type: Number, default: 0 },
}, { _id: false });

const CollectedPhoneSchema = new Schema({
  // Status
  status: {
    type: String,
    enum: ['pending', 'needs_review', 'approved', 'rejected', 'imported', 'failed'],
    default: 'pending',
  },

  // Normalized phone data
  brandName: { type: String, required: true },
  model: { type: String, required: true },
  slug: { type: String, required: true },
  releaseDate: { type: String, default: '' },
  announcedDate: { type: String, default: '' },
  availability: { type: String, default: '' },
  deviceStatus: { type: String, default: '' },
  deviceType: { type: String, default: '' },

  // Spec sections (stored as sub-documents)
  display: {
    type: { size: String, resolution: String, type: String, refreshRate: String, brightness: String, protection: String, aspectRatio: String, pixelDensity: String, hdrSupport: String },
    default: {},
  },
  processor: {
    type: { chipset: String, cpu: String, gpu: String, process: String },
    default: {},
  },
  memory: {
    type: { ram: String, ramType: String, storage: String, storageType: String, cardSlot: String },
    default: {},
  },
  camera: {
    type: { rearModules: String, frontCamera: String, aperture: String, sensorSize: String, ois: String, eis: String, zoom: String, videoRecording: String, cameraFeatures: String },
    default: {},
  },
  battery: {
    type: { capacity: String, type: String, wiredCharging: String, wirelessCharging: String, reverseCharging: String },
    default: {},
  },
  body: {
    type: { dimensions: String, weight: String, build: String, waterResistance: String, colors: String, sim: String },
    default: {},
  },
  connectivity: {
    type: { network: String, fiveG: String, wifi: String, bluetooth: String, nfc: String, usb: String, gps: String, infrared: String },
    default: {},
  },
  software: {
    type: { os: String, osVersion: String, osUI: String, updatePolicy: String },
    default: {},
  },
  audio: {
    type: { speakers: String, headphoneJack: String },
    default: {},
  },
  sensors: {
    type: { fingerprint: String, accelerometer: String, gyroscope: String, compass: String, proximity: String, others: String },
    default: {},
  },
  benchmarks: {
    type: { antutu: Number, geekbenchSingle: Number, geekbenchMulti: Number, gamingScore: Number, pubgFps: String, codMobileFps: String, genshinFps: String },
    default: {},
  },

  // Media
  images: [{ type: String }],
  thumbnail: { type: String, default: '' },

  // Approval link
  approvedPhoneId: { type: Schema.Types.ObjectId, ref: 'Phone' },
  description: { type: String, default: '' },

  // Pakistan-specific
  pakistanPrice: { type: Number, default: null },
  pakistanMarketPrice: { type: Number, default: null },
  ptaApproved: { type: Boolean, default: null },
  ptaStatus: { type: String, default: '' },
  ptaTaxEstimate: { type: Number, default: null },
  officialWarranty: { type: String, default: '' },
  localAvailability: { type: String, default: '' },
  localSellerNotes: { type: String, default: '' },

  // Auto-suggested fields (never auto-published)
  suggestedCategory: { type: String, default: '' },
  suggestedSeoTitle: { type: String, default: '' },
  suggestedSeoDescription: { type: String, default: '' },
  suggestedKeywords: { type: String, default: '' },
  aiGeneratedFields: [{ type: String }], // tracks which fields were AI-suggested

  // Provenance
  sourceId: { type: Schema.Types.ObjectId, ref: 'CollectorSource' },
  sourceName: { type: String, default: '' },
  sourceUrl: { type: String, default: '' },
  collectedAt: { type: Date, default: Date.now },
  providerRecordId: { type: String, default: '' },

  // Field-level provenance
  fieldProvenance: [fieldProvenanceSchema],

  // Duplicate detection
  duplicateMatches: [duplicateMatchSchema],
  hasExactDuplicate: { type: Boolean, default: false },
  duplicatePhoneId: { type: String, default: '' },

  // Conflict detection
  conflicts: [conflictSchema],
  conflictCount: { type: Number, default: 0 },

  // Validation
  validationIssues: [{ type: String }],
  isValid: { type: Boolean, default: true },

  // Review
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  reviewedAt: { type: Date },
  reviewNotes: { type: String, default: '' },
  adminEdits: { type: Schema.Types.Mixed, default: {} },
  importedPhoneId: { type: String, default: '' },

  // Job reference
  jobId: { type: Schema.Types.ObjectId, ref: 'CollectorJob' },

  // Reliability
  sourceReliability: { type: Number, default: 1.0 },
}, { timestamps: true });

CollectedPhoneSchema.index({ status: 1 });
CollectedPhoneSchema.index({ slug: 1 });
CollectedPhoneSchema.index({ brandName: 1, model: 1 });
CollectedPhoneSchema.index({ sourceId: 1 });
CollectedPhoneSchema.index({ jobId: 1 });
CollectedPhoneSchema.index({ createdAt: -1 });
CollectedPhoneSchema.index({ 'duplicateMatches.confidence': -1 });
CollectedPhoneSchema.index({ approvedPhoneId: 1, status: 1 });

export const CollectedPhone = mongoose.models.CollectedPhone || mongoose.model('CollectedPhone', CollectedPhoneSchema);