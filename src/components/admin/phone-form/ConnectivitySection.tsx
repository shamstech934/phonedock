import type { PhoneFormData } from './types';
import { TextInput } from './FormFields';

interface SectionProps {
  form: PhoneFormData;
  set: <K extends keyof PhoneFormData>(key: K, value: PhoneFormData[K]) => void;
}

export default function ConnectivitySection({ form, set }: SectionProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <TextInput
        label="Network"
        value={form.network}
        onChange={(v) => set('network', v)}
        placeholder="e.g. GSM / HSPA / LTE / 5G"
      />
      <TextInput
        label="5G"
        value={form.fiveG}
        onChange={(v) => set('fiveG', v)}
        placeholder="e.g. SA/NSA"
      />
      <TextInput
        label="WiFi"
        value={form.wifi}
        onChange={(v) => set('wifi', v)}
        placeholder="e.g. Wi-Fi 7, 802.11be"
      />
      <TextInput
        label="Bluetooth"
        value={form.bluetooth}
        onChange={(v) => set('bluetooth', v)}
        placeholder="e.g. 5.3, A2DP, LE"
      />
      <TextInput
        label="NFC"
        value={form.nfc}
        onChange={(v) => set('nfc', v)}
        placeholder="e.g. Yes"
      />
      <TextInput
        label="USB"
        value={form.usb}
        onChange={(v) => set('usb', v)}
        placeholder="e.g. USB Type-C 3.2"
      />
      <TextInput
        label="Fingerprint"
        value={form.fingerprint}
        onChange={(v) => set('fingerprint', v)}
        placeholder="e.g. Ultrasonic, under display"
      />
      <TextInput
        label="Face Unlock"
        value={form.faceUnlock}
        onChange={(v) => set('faceUnlock', v)}
        placeholder="e.g. Yes"
      />
      <TextInput
        label="Sensors"
        value={form.sensors}
        onChange={(v) => set('sensors', v)}
        placeholder="e.g. Accelerometer, Gyro, Proximity"
      />
      <TextInput
        label="OS"
        value={form.os}
        onChange={(v) => set('os', v)}
        placeholder="e.g. Android"
      />
      <TextInput
        label="OS Version"
        value={form.osVersion}
        onChange={(v) => set('osVersion', v)}
        placeholder="e.g. 14"
      />
      <TextInput
        label="OS UI"
        value={form.osUI}
        onChange={(v) => set('osUI', v)}
        placeholder="e.g. One UI 6.1"
      />
      <TextInput
        label="Update Policy"
        value={form.updatePolicy}
        onChange={(v) => set('updatePolicy', v)}
        placeholder="e.g. 7 years"
      />
      <TextInput
        label="Special Features"
        value={form.specialFeatures}
        onChange={(v) => set('specialFeatures', v)}
        placeholder="e.g. S-Pen, Samsung DeX"
      />
    </div>
  );
}