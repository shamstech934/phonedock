import type { PhoneFormData } from './types';
import { TextInput, NumberInput } from './FormFields';

interface SectionProps {
  form: PhoneFormData;
  set: <K extends keyof PhoneFormData>(key: K, value: PhoneFormData[K]) => void;
}

export default function BenchmarkSection({ form, set }: SectionProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <NumberInput
        label="AnTuTu Score"
        value={form.antutuScore}
        onChange={(v) => set('antutuScore', v)}
        placeholder="e.g. 2240000"
      />
      <NumberInput
        label="Geekbench Single"
        value={form.geekbenchSingle}
        onChange={(v) => set('geekbenchSingle', v)}
        placeholder="e.g. 2200"
      />
      <NumberInput
        label="Geekbench Multi"
        value={form.geekbenchMulti}
        onChange={(v) => set('geekbenchMulti', v)}
        placeholder="e.g. 7000"
      />
      <NumberInput
        label="Gaming Score"
        value={form.gamingScore}
        onChange={(v) => set('gamingScore', v)}
        placeholder="e.g. 985"
      />
      <TextInput
        label="PUBG FPS"
        value={form.pubgFPS}
        onChange={(v) => set('pubgFPS', v)}
        placeholder="e.g. 90 FPS"
      />
      <TextInput
        label="COD Mobile FPS"
        value={form.codMobileFPS}
        onChange={(v) => set('codMobileFPS', v)}
        placeholder="e.g. 60 FPS"
      />
      <TextInput
        label="Genshin FPS"
        value={form.genshinFPS}
        onChange={(v) => set('genshinFPS', v)}
        placeholder="e.g. 60 FPS"
      />
      <TextInput
        label="Video Playback"
        value={form.videoPlayback}
        onChange={(v) => set('videoPlayback', v)}
        placeholder="e.g. Up to 29 hours"
      />
      <TextInput
        label="Gaming Battery"
        value={form.gamingBattery}
        onChange={(v) => set('gamingBattery', v)}
        placeholder="e.g. 7 hours"
      />
      <TextInput
        label="Browsing Battery"
        value={form.browsingBattery}
        onChange={(v) => set('browsingBattery', v)}
        placeholder="e.g. 14 hours"
      />
      <NumberInput
        label="Camera Score"
        value={form.cameraScore}
        onChange={(v) => set('cameraScore', v)}
        min={0}
        max={100}
      />
      <NumberInput
        label="Performance Score"
        value={form.performanceScore}
        onChange={(v) => set('performanceScore', v)}
        min={0}
        max={100}
      />
      <NumberInput
        label="Battery Score"
        value={form.batteryScore}
        onChange={(v) => set('batteryScore', v)}
        min={0}
        max={100}
      />
      <NumberInput
        label="Display Score"
        value={form.displayScore}
        onChange={(v) => set('displayScore', v)}
        min={0}
        max={100}
      />
      <NumberInput
        label="Value Score"
        value={form.valueScore}
        onChange={(v) => set('valueScore', v)}
        min={0}
        max={100}
      />
      <NumberInput
        label="Overall Rating"
        value={form.overallRating}
        onChange={(v) => set('overallRating', v)}
        min={0}
        max={100}
      />
    </div>
  );
}