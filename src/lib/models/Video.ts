import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IVideo extends Document {
  youtubeId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: Date;
  phoneId: Types.ObjectId | null;
  active: boolean;
  autoLinked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VideoSchema = new Schema<IVideo>(
  {
    youtubeId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    thumbnailUrl: { type: String, required: true },
    publishedAt: { type: Date, required: true },
    phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', default: null, index: true },
    active: { type: Boolean, default: true },
    autoLinked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Video = (mongoose.models.Video as mongoose.Model<IVideo>) || mongoose.model<IVideo>('Video', VideoSchema);