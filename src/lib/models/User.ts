import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  emailVerified: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'blocked'], default: 'active', index: true },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

export interface IUser extends mongoose.Document {
  name: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  status: 'active' | 'blocked';
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
