import mongoose, { Schema } from 'mongoose';

export const DEVICE_SPEC_TEXT_FIELDS = [
  'display','displayType','resolution','refreshRate','protection','brightness',
  'chipset','cpu','gpu','process','ram','ramType','storage','cardSlot',
  'mainCamera','mainCameraSensor','aperture','ois','eis','ultrawide','telephoto','zoom','cameraFeatures','videoRecording',
  'selfieCamera','selfieSensor','selfieVideo',
  'battery','charging','chargingSpeed','wirelessCharge','wirelessSpeed','reverseCharge',
  'weight','dimensions','build','sim','ipRating','network','fiveG','wifi','bluetooth','nfc','usb','infrared',
  'fingerprint','faceUnlock','sensors','colors','os','osVersion','osUI','updatePolicy','specialFeatures',
] as const;

export type DeviceSpecTextField = typeof DEVICE_SPEC_TEXT_FIELDS[number];

export interface IDeviceSpecDataset extends Record<DeviceSpecTextField, string> {
  brand: string; model: string; normalizedBrand: string; normalizedModel: string;
  sourceName: string; sourceUrl: string;
}

const specFields: Record<string, { type: typeof String; default: string }> = {};
for (const field of DEVICE_SPEC_TEXT_FIELDS) specFields[field] = { type: String, default: '' };

const DeviceSpecDatasetSchema = new Schema<IDeviceSpecDataset>({
  brand: { type: String, default: '', trim: true },
  model: { type: String, required: true, trim: true },
  normalizedBrand: { type: String, default: '', index: true },
  normalizedModel: { type: String, required: true, index: true },
  ...specFields,
  sourceName: { type: String, default: 'Imported dataset' },
  sourceUrl: { type: String, default: '' },
}, { timestamps: true });

DeviceSpecDatasetSchema.index({ normalizedBrand: 1, normalizedModel: 1 }, { unique: true });
export const DeviceSpecDataset = mongoose.models.DeviceSpecDataset || mongoose.model<IDeviceSpecDataset>('DeviceSpecDataset', DeviceSpecDatasetSchema);
