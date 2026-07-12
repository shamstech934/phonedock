import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPhoneSpecs extends Document {
  phoneId: Types.ObjectId;
  display: string;
  displayType: string;
  resolution: string;
  refreshRate: string;
  protection: string;
  brightness: string;
  chipset: string;
  cpu: string;
  gpu: string;
  process: string;
  ram: string;
  ramType: string;
  storage: string;
  cardSlot: string;
  mainCamera: string;
  mainCameraSensor: string;
  aperture: string;
  ois: string;
  eis: string;
  ultrawide: string;
  telephoto: string;
  zoom: string;
  cameraFeatures: string;
  videoRecording: string;
  selfieCamera: string;
  selfieSensor: string;
  selfieVideo: string;
  battery: string;
  charging: string;
  chargingSpeed: string;
  wirelessCharge: string;
  wirelessSpeed: string;
  reverseCharge: string;
  weight: string;
  dimensions: string;
  build: string;
  sim: string;
  ipRating: string;
  network: string;
  fiveG: string;
  wifi: string;
  bluetooth: string;
  nfc: string;
  usb: string;
  fingerprint: string;
  faceUnlock: string;
  sensors: string;
  colors: string;
  os: string;
  osVersion: string;
  osUI: string;
  updatePolicy: string;
  specialFeatures: string;
}

const specFields: Record<string, { type: typeof String; default: string }> = {};
const specNames = [
  'display','displayType','resolution','refreshRate','protection','brightness',
  'chipset','cpu','gpu','process','ram','ramType','storage','cardSlot',
  'mainCamera','mainCameraSensor','aperture','ois','eis','ultrawide','telephoto','zoom','cameraFeatures','videoRecording',
  'selfieCamera','selfieSensor','selfieVideo',
  'battery','charging','chargingSpeed','wirelessCharge','wirelessSpeed','reverseCharge',
  'weight','dimensions','build','sim','ipRating','network','fiveG','wifi','bluetooth','nfc','usb',
  'fingerprint','faceUnlock','sensors','colors',
  'os','osVersion','osUI','updatePolicy','specialFeatures',
];
for (const f of specNames) specFields[f] = { type: String, default: '' };

const PhoneSpecsSchema = new Schema<IPhoneSpecs>({
  phoneId: { type: Schema.Types.ObjectId, ref: 'Phone', required: true },
  ...specFields,
}, { timestamps: true });

export const PhoneSpecs = mongoose.models.PhoneSpecs || mongoose.model<IPhoneSpecs>('PhoneSpecs', PhoneSpecsSchema);