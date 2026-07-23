import mongoose, { Schema } from 'mongoose';

const SourceSchema = new Schema({ title: String, url: String, domain: String, excerpt: String, score: Number }, { _id: false });
const AIResearchDraftSchema = new Schema({
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true, index: true },
  type: { type: String, enum: ['specs','images','prices'], required: true, index: true },
  status: { type: String, enum: ['pending_review','approved','rejected'], default: 'pending_review', index: true },
  jobId: { type: Schema.Types.ObjectId, ref: 'AIResearchJob', index: true },
  brand: String,
  model: String,
  confidence: { type: Number, default: 0 },
  sourceNotes: String,
  sources: [SourceSchema],
  conflicts: [String],
  specs: { display: String, chipset: String, ram: String, storage: String, battery: String, mainCamera: String, fiveG: String },
  images: [{ url: String, sourceUrl: String, title: String }],
  price: { valuePKR: Number, sourceName: String, sourceUrl: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  reviewedAt: Date,
  editedAt: Date,
  publishResult: { specs: Boolean, image: Boolean, price: Boolean, message: String },
}, { timestamps: true });
AIResearchDraftSchema.index({ phoneId: 1, type: 1, status: 1, createdAt: -1 });
export const AIResearchDraft = mongoose.models.AIResearchDraft || mongoose.model('AIResearchDraft', AIResearchDraftSchema);
