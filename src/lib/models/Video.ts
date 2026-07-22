import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IVideo extends Document {
  youtubeId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: Date;
  phoneId: Types.ObjectId | null;
  brandId: Types.ObjectId | null;
  active: boolean;
  autoLinked: boolean;
  status: 'live' | 'pending' | 'draft' | 'hidden' | 'rejected' | 'failed';
  featured: boolean;
  hidden: boolean;
  syncStatus: 'synced' | 'not_synced' | 'failed';
  views: number;
  likes: number;
  commentCount: number;
  duration: string;
  channelName: string;
  category: string;
  lastSyncedAt: Date | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const VideoSchema = new Schema<IVideo>(
  {
    youtubeId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    thumbnailUrl: { type: String, required: true },
    publishedAt: { type: Date, required: true },
    phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', default: null, index: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand', default: null, index: true },
    active: { type: Boolean, default: true },
    autoLinked: { type: Boolean, default: false },
    status: { type: String, enum: ['live', 'pending', 'draft', 'hidden', 'rejected', 'failed'], default: 'pending' },
    featured: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
    syncStatus: { type: String, enum: ['synced', 'not_synced', 'failed'], default: 'not_synced' },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    duration: { type: String, default: '' },
    channelName: { type: String, default: '' },
    category: { type: String, default: '' },
    lastSyncedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true }
);

VideoSchema.index({ status: 1 });
VideoSchema.index({ featured: 1 });
VideoSchema.index({ syncStatus: 1 });
VideoSchema.index({ createdAt: -1 });
VideoSchema.index({ active: 1, publishedAt: -1 });
VideoSchema.index({ lastSyncedAt: -1 });

export const Video = (mongoose.models.Video as mongoose.Model<IVideo>) || mongoose.model<IVideo>('Video', VideoSchema);
