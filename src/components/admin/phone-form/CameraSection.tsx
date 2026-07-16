import type { PhoneFormData } from './types';
import { TextInput, NumberInput } from './FormFields';

interface SectionProps {
  form: PhoneFormData;
  set: <K extends keyof PhoneFormData>(key: K, value: PhoneFormData[K]) => void;
}

export default function CameraSection({ form, set }: SectionProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <TextInput
        label="Main Camera"
        value={form.mainCamera}
        onChange={(v) => set('mainCamera', v)}
        placeholder="e.g. 200MP + 50MP + 12MP + 10MP"
      />
      <TextInput
        label="Main Camera Sensor"
        value={form.mainCameraSensor}
        onChange={(v) => set('mainCameraSensor', v)}
        placeholder="e.g. ISOCELL HP2"
      />
      <TextInput
        label="Aperture"
        value={form.aperture}
        onChange={(v) => set('aperture', v)}
        placeholder="e.g. f/1.7"
      />
      <TextInput
        label="OIS"
        value={form.ois}
        onChange={(v) => set('ois', v)}
        placeholder="e.g. Yes"
      />
      <TextInput
        label="EIS"
        value={form.eis}
        onChange={(v) => set('eis', v)}
        placeholder="e.g. Yes"
      />
      <TextInput
        label="Ultrawide"
        value={form.ultrawide}
        onChange={(v) => set('ultrawide', v)}
        placeholder="e.g. 12MP, f/2.2"
      />
      <TextInput
        label="Telephoto"
        value={form.telephoto}
        onChange={(v) => set('telephoto', v)}
        placeholder="e.g. 10MP, 3x optical"
      />
      <TextInput
        label="Zoom"
        value={form.zoom}
        onChange={(v) => set('zoom', v)}
        placeholder="e.g. 100x Space Zoom"
      />
      <TextInput
        label="Camera Features"
        value={form.cameraFeatures}
        onChange={(v) => set('cameraFeatures', v)}
        placeholder="e.g. LED flash, HDR, panorama"
      />
      <TextInput
        label="Video Recording"
        value={form.videoRecording}
        onChange={(v) => set('videoRecording', v)}
        placeholder="e.g. 8K@30fps, 4K@60fps"
      />
      <TextInput
        label="Selfie Camera"
        value={form.selfieCamera}
        onChange={(v) => set('selfieCamera', v)}
        placeholder="e.g. 12MP"
      />
      <TextInput
        label="Selfie Sensor"
        value={form.selfieSensor}
        onChange={(v) => set('selfieSensor', v)}
        placeholder="e.g. Sony IMX564"
      />
      <TextInput
        label="Selfie Video"
        value={form.selfieVideo}
        onChange={(v) => set('selfieVideo', v)}
        placeholder="e.g. 4K@60fps"
      />
      <div className="col-span-full border-t border-gray-200 pt-4 mt-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Numeric Filter Fields</p>
      </div>
      <NumberInput
        label="Main Camera (MP)"
        value={form.mainCameraMP}
        onChange={(v) => set('mainCameraMP', v)}
        placeholder="e.g. 200"
        min={0}
        max={500}
      />
    </div>
  );
}