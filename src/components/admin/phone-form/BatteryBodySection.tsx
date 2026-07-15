import type { PhoneFormData } from './types';
import { TextInput } from './FormFields';

interface SectionProps {
  form: PhoneFormData;
  set: <K extends keyof PhoneFormData>(key: K, value: PhoneFormData[K]) => void;
}

export default function BatteryBodySection({ form, set }: SectionProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <TextInput
        label="Battery"
        value={form.battery}
        onChange={(v) => set('battery', v)}
        placeholder="e.g. 5000 mAh"
      />
      <TextInput
        label="Charging"
        value={form.charging}
        onChange={(v) => set('charging', v)}
        placeholder="e.g. Fast Charging"
      />
      <TextInput
        label="Charging Speed"
        value={form.chargingSpeed}
        onChange={(v) => set('chargingSpeed', v)}
        placeholder="e.g. 45W"
      />
      <TextInput
        label="Wireless Charge"
        value={form.wirelessCharge}
        onChange={(v) => set('wirelessCharge', v)}
        placeholder="e.g. Yes"
      />
      <TextInput
        label="Wireless Speed"
        value={form.wirelessSpeed}
        onChange={(v) => set('wirelessSpeed', v)}
        placeholder="e.g. 15W"
      />
      <TextInput
        label="Reverse Charge"
        value={form.reverseCharge}
        onChange={(v) => set('reverseCharge', v)}
        placeholder="e.g. 4.5W"
      />
      <TextInput
        label="Weight"
        value={form.weight}
        onChange={(v) => set('weight', v)}
        placeholder="e.g. 232g"
      />
      <TextInput
        label="Dimensions"
        value={form.dimensions}
        onChange={(v) => set('dimensions', v)}
        placeholder="e.g. 162.3 x 77.6 x 8.6 mm"
      />
      <TextInput
        label="Build"
        value={form.build}
        onChange={(v) => set('build', v)}
        placeholder="e.g. Glass front/back, Titanium frame"
      />
      <TextInput
        label="SIM"
        value={form.sim}
        onChange={(v) => set('sim', v)}
        placeholder="e.g. Dual Nano-SIM"
      />
      <TextInput
        label="IP Rating"
        value={form.ipRating}
        onChange={(v) => set('ipRating', v)}
        placeholder="e.g. IP68"
      />
      <TextInput
        label="Colors"
        value={form.colors}
        onChange={(v) => set('colors', v)}
        placeholder="e.g. Titanium Gray, Titanium Black"
      />
    </div>
  );
}