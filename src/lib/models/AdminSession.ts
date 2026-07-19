import mongoose, { Schema } from 'mongoose';

const AdminSessionSchema = new Schema({
  adminId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
  tokenJti: { type: String, required: true, unique: true },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  expiresAt: { type: Date, required: true },
  lastUsedAt: { type: Date, default: Date.now },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });

// TTL index: auto-delete expired sessions after 1 hour
AdminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600, background: true });
AdminSessionSchema.index({ adminId: 1, revokedAt: 1 });
AdminSessionSchema.index({ revokedAt: 1, expiresAt: 1 });

export interface IAdminSession extends mongoose.Document {
  adminId: mongoose.Types.ObjectId;
  tokenJti: string;
  ip: string;
  userAgent: string;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const AdminSession = mongoose.models.AdminSession || mongoose.model<IAdminSession>('AdminSession', AdminSessionSchema);