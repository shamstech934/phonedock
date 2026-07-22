import mongoose, { Schema } from 'mongoose';

const OwnedPhoneSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true },
  folder: { type: String, default: 'default', trim: true, maxlength: 40 },
}, { timestamps: true });
OwnedPhoneSchema.index({ userId: 1, phoneId: 1 }, { unique: true });

const RecentlyViewedSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true },
  viewedAt: { type: Date, default: Date.now },
}, { timestamps: true });
RecentlyViewedSchema.index({ userId: 1, phoneId: 1 }, { unique: true });
RecentlyViewedSchema.index({ userId: 1, viewedAt: -1 });

const CompareHistorySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  phoneIds: [{ type: Schema.Types.ObjectId, ref: 'Phone', required: true }],
  shareId: { type: String, required: true, unique: true },
}, { timestamps: true });
CompareHistorySchema.index({ userId: 1, createdAt: -1 });

const NotificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['price_drop', 'pta_change', 'restock', 'review', 'system'], required: true },
  title: { type: String, required: true, maxlength: 120 },
  message: { type: String, required: true, maxlength: 500 },
  href: { type: String, default: '', maxlength: 500 },
  readAt: { type: Date, default: null },
  archivedAt: { type: Date, default: null },
}, { timestamps: true });
NotificationSchema.index({ userId: 1, archivedAt: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, readAt: 1 });

export const Wishlist = mongoose.models.Wishlist || mongoose.model('Wishlist', OwnedPhoneSchema);
export const Favorite = mongoose.models.Favorite || mongoose.model('Favorite', OwnedPhoneSchema.clone());
export const RecentlyViewed = mongoose.models.RecentlyViewed || mongoose.model('RecentlyViewed', RecentlyViewedSchema);
export const CompareHistory = mongoose.models.CompareHistory || mongoose.model('CompareHistory', CompareHistorySchema);
export const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
