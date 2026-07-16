import type { PhoneFormData } from './types';
import { TextInput, NumberInput } from './FormFields';

interface SectionProps {
  form: PhoneFormData;
  set: <K extends keyof PhoneFormData>(key: K, value: PhoneFormData[K]) => void;
}

export default function DisplayProcessorSection({ form, set }: SectionProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <TextInput
        label="Display"
        value={form.display}
        onChange={(v) => set('display', v)}
        placeholder='e.g. 6.8"'
      />
      <TextInput
        label="Display Type"
        value={form.displayType}
        onChange={(v) => set('displayType', v)}
        placeholder="e.g. Dynamic AMOLED 2X"
      />
      <TextInput
        label="Resolution"
        value={form.resolution}
        onChange={(v) => set('resolution', v)}
        placeholder="e.g. 1440 x 3120"
      />
      <TextInput
        label="Refresh Rate"
        value={form.refreshRate}
        onChange={(v) => set('refreshRate', v)}
        placeholder="e.g. 120Hz"
      />
      <TextInput
        label="Protection"
        value={form.protection}
        onChange={(v) => set('protection', v)}
        placeholder="e.g. Gorilla Glass Victus 2"
      />
      <TextInput
        label="Brightness"
        value={form.brightness}
        onChange={(v) => set('brightness', v)}
        placeholder="e.g. 2600 nits peak"
      />
      <TextInput
        label="Chipset"
        value={form.chipset}
        onChange={(v) => set('chipset', v)}
        placeholder="e.g. Snapdragon 8 Gen 3"
      />
      <TextInput
        label="CPU"
        value={form.cpu}
        onChange={(v) => set('cpu', v)}
        placeholder="e.g. Octa-core"
      />
      <TextInput
        label="GPU"
        value={form.gpu}
        onChange={(v) => set('gpu', v)}
        placeholder="e.g. Adreno 750"
      />
      <TextInput
        label="Process"
        value={form.process}
        onChange={(v) => set('process', v)}
        placeholder="e.g. 4nm"
      />
      <TextInput
        label="RAM"
        value={form.ram}
        onChange={(v) => set('ram', v)}
        placeholder="e.g. 12GB"
      />
      <TextInput
        label="RAM Type"
        value={form.ramType}
        onChange={(v) => set('ramType', v)}
        placeholder="e.g. LPDDR5X"
      />
      <TextInput
        label="Storage"
        value={form.storage}
        onChange={(v) => set('storage', v)}
        placeholder="e.g. 256GB"
      />
      <TextInput
        label="Card Slot"
        value={form.cardSlot}
        onChange={(v) => set('cardSlot', v)}
        placeholder="e.g. microSDXC up to 1TB"
      />
      <div className="col-span-full border-t border-gray-200 pt-4 mt-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Numeric Filter Fields</p>
      </div>
      <NumberInput
        label="Screen Size (inch)"
        value={form.screenSizeInch}
        onChange={(v) => set('screenSizeInch', v)}
        placeholder="e.g. 6.7"
        min={0}
        max={10}
      />
      <NumberInput
        label="RAM (GB)"
        value={form.ramGB}
        onChange={(v) => set('ramGB', v)}
        placeholder="e.g. 8"
        min={0}
        max={32}
      />
      <NumberInput
        label="Storage (GB)"
        value={form.storageGB}
        onChange={(v) => set('storageGB', v)}
        placeholder="e.g. 256"
        min={0}
        max={2048}
      />
    </div>
  );
}