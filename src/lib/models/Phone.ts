import mongoose, { Schema, Document, Types, Model } from 'mongoose';

export interface IBrand {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  logo: string;
  country: string;
  description: string;
}

export interface IPhone extends Document {
  brandId: Types.ObjectId;
  brand?: IBrand;
  modelName: string;
  slug: string;
  releaseDate: string;
  pricePKR: number;
  originalPricePKR: number;
  ptaStatus: string;
  ptaApproved: boolean;
  featured: boolean;
  trending: boolean;
  upcoming: boolean;
  thumbnail: string;
  description: string;
  cameraScore: number;
  performanceScore: number;
  batteryScore: number;
  displayScore: number;
  valueScore: number;
  overallRating: number;
  sortOrder: number;
  active: boolean;
  pros: string;
  cons: string;
  reviewSummary: string;
  reviewVerdict: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string;
  views: number;
  status: string;
  sourceName: string;
  sourceUrl: string;
  lastVerifiedAt: Date | null;
  dataConfidence: 'verified' | 'unverified' | 'auto-imported' | 'user-submitted';
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  publishedBy: Types.ObjectId | null;
  publishedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPhoneModel extends Model<IPhone> {
  findActive(): typeof Model.find;
}

const PhoneSchema = new Schema<IPhone>({
  brandId: { type: Schema.Types.ObjectId, ref: 'Brand', required: true },
  modelName: { type: String, required: true },
  slug: { type: String, required: true },
  releaseDate: { type: String, default: '' },
  pricePKR: { type: Number, default: 0 },
  originalPricePKR: { type: Number, default: 0 },
  ptaStatus: { type: String, default: 'Unknown' },
  ptaApproved: { type: Boolean, default: false },
  featured: { type: Boolean, default: false },
  trending: { type: Boolean, default: false },
  upcoming: { type: Boolean, default: false },
  thumbnail: { type: String, default: '' },
  description: { type: String, default: '' },
  cameraScore: { type: Number, default: 0 },
  performanceScore: { type: Number, default: 0 },
  batteryScore: { type: Number, default: 0 },
  displayScore: { type: Number, default: 0 },
  valueScore: { type: Number, default: 0 },
  overallRating: { type: Number, default: 0 },
  sortOrder: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  pros: { type: String, default: '' },
  cons: { type: String, default: '' },
  reviewSummary: { type: String, default: '' },
  reviewVerdict: { type: String, default: '' },
  seoTitle: { type: String, default: '' },
  seoDescription: { type: String, default: '' },
  keywords: { type: String, default: '' },
  views: { type: Number, default: 0 },
  status: { type: String, enum: ['published', 'draft', 'pending', 'archived'], default: 'published' },
  sourceName: { type: String, default: '' },
  sourceUrl: { type: String, default: '' },
  lastVerifiedAt: { type: Date, default: null },
  dataConfidence: { type: String, enum: ['verified', 'unverified', 'auto-imported', 'user-submitted'], default: 'unverified' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  publishedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  publishedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual for brand population
PhoneSchema.virtual('brand', {
  ref: 'Brand',
  localField: 'brandId',
  foreignField: '_id',
  justOne: true,
});

PhoneSchema.pre('save', async function(this: any) {
  if (!this.slug && this.modelName) {
    this.slug = this.modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
});

PhoneSchema.index({ slug: 1 }, { unique: true });
PhoneSchema.index({ createdAt: -1 });
PhoneSchema.index({ active: 1, status: 1, createdAt: -1 });
PhoneSchema.index({ brandId: 1, status: 1 });
PhoneSchema.index({ pricePKR: 1 });
PhoneSchema.index({ trending: 1 });
PhoneSchema.index({ featured: 1 });
PhoneSchema.index({ modelName: 'text', description: 'text' });

// Static method to find only non-soft-deleted documents
PhoneSchema.statics.findActive = function() {
  return this.find({ deletedAt: null });
};

export const Phone = (mongoose.models.Phone as IPhoneModel) || mongoose.model<IPhone, IPhoneModel>('Phone', PhoneSchema);