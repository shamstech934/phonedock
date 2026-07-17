import mongoose, { Schema } from 'mongoose';

/**
 * SystemState — Persistent bootstrap & system-level state (serverless-safe).
 *
 * Unlike in-memory flags, this collection survives cold starts and
 * function-instance recycling on Vercel / other serverless platforms.
 */
const SystemStateSchema = new Schema({
  key: { type: String, required: true, unique: true, index: true },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
  completedByAdminId: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

export interface ISystemState extends mongoose.Document {
  key: string;
  completed: boolean;
  completedAt: Date | null;
  completedByAdminId: mongoose.Types.ObjectId | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export const SystemState = mongoose.models.SystemState || mongoose.model<ISystemState>('SystemState', SystemStateSchema);