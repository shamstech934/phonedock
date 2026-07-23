import mongoose, { Schema, Document } from 'mongoose';

export interface IDeviceSpecDataset extends Document {
  brand: string; model: string; normalizedBrand: string; normalizedModel: string;
  display: string; chipset: string; ram: string; storage: string; battery: string;
  mainCamera: string; fiveG: string; sourceName: string; sourceUrl: string;
}

const DeviceSpecDatasetSchema = new Schema<IDeviceSpecDataset>({
  brand: { type: String, default: '', trim: true }, model: { type: String, required: true, trim: true },
  normalizedBrand: { type: String, default: '', index: true }, normalizedModel: { type: String, required: true, index: true },
  display: { type: String, default: '' }, chipset: { type: String, default: '' }, ram: { type: String, default: '' },
  storage: { type: String, default: '' }, battery: { type: String, default: '' }, mainCamera: { type: String, default: '' },
  fiveG: { type: String, default: '' }, sourceName: { type: String, default: 'Imported dataset' }, sourceUrl: { type: String, default: '' },
}, { timestamps: true });
DeviceSpecDatasetSchema.index({ normalizedBrand: 1, normalizedModel: 1 }, { unique: true });
export const DeviceSpecDataset = mongoose.models.DeviceSpecDataset || mongoose.model<IDeviceSpecDataset>('DeviceSpecDataset', DeviceSpecDatasetSchema);
