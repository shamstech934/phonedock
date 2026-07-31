import mongoose, { Schema } from 'mongoose';

const LaunchCandidateSchema = new Schema({
  brandName: { type: String, required: true, trim: true, index: true },
  modelName: { type: String, required: true, trim: true },
  normalizedKey: { type: String, required: true, unique: true, index: true },
  sourceNewsId: { type: Schema.Types.ObjectId, ref: 'News', default: null },
  sourceName: { type: String, default: '' },
  sourceUrl: { type: String, default: '' },
  sourceTitle: { type: String, default: '' },
  sourcePublishedAt: { type: Date, default: null },
  availabilityStatus: { type: String, enum: ['rumored', 'announced', 'coming_soon'], default: 'rumored' },
  confidence: { type: Number, min: 0, max: 1, default: 0.5 },
  reasons: { type: [String], default: [] },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'duplicate'], default: 'pending', index: true },
  linkedPhoneId: { type: Schema.Types.ObjectId, ref: 'Phone', default: null },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  reviewedAt: { type: Date, default: null },
  reviewNotes: { type: String, default: '' },
}, { timestamps: true });

LaunchCandidateSchema.index({ status: 1, createdAt: -1 });
LaunchCandidateSchema.index({ brandName: 1, modelName: 1 });

export const LaunchCandidate = mongoose.models.LaunchCandidate || mongoose.model('LaunchCandidate', LaunchCandidateSchema);
