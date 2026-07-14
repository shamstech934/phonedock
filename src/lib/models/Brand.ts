import mongoose, { Schema, Document } from 'mongoose';

export interface IBrand extends Document {
  name: string;
  slug: string;
  logo: string;
  country: string;
  description: string;
  sortOrder: number;
  active: boolean;
  website: string;
  seoTitle: string;
  seoDescription: string;
  createdAt: Date;
  updatedAt: Date;
}

const BrandSchema = new Schema<IBrand>({
  name: { type: String, required: true },
  slug: { type: String, required: true },
  logo: { type: String, default: '' },
  country: { type: String, default: '' },
  description: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  website: { type: String, default: '' },
  seoTitle: { type: String, default: '' },
  seoDescription: { type: String, default: '' },
}, { timestamps: true });

(BrandSchema as any).pre('save', function(this: any, next: (err?: any) => void) {
  if (!this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

BrandSchema.index({ slug: 1 }, { unique: true });
BrandSchema.index({ active: 1 });
BrandSchema.index({ sortOrder: 1 });

export const Brand = mongoose.models.Brand || mongoose.model<IBrand>('Brand', BrandSchema);