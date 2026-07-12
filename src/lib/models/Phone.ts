import mongoose, { Schema, Document, Types } from 'mongoose';

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
  createdAt: Date;
  updatedAt: Date;
}

const PhoneSchema = new Schema<IPhone>({
  brandId: { type: Schema.Types.ObjectId, ref: 'Brand', required: true },
  modelName: { type: String, required: true },
  slug: { type: String, required: true },
  releaseDate: { type: String, default: '' },
  pricePKR: { type: Number, default: 0 },
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
  status: { type: String, default: 'published' },
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

PhoneSchema.index({ slug: 1, unique: true });
PhoneSchema.index({ brandId: 1 });
PhoneSchema.index({ pricePKR: 1 });
PhoneSchema.index({ status: 1 });
PhoneSchema.index({ active: 1, status: 1 });
PhoneSchema.index({ trending: 1 });
PhoneSchema.index({ featured: 1 });

export const Phone = mongoose.models.Phone || mongoose.model<IPhone>('Phone', PhoneSchema);