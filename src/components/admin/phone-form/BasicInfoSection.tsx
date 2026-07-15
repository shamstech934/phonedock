import Image from 'next/image';
import { Smartphone } from 'lucide-react';
import type { PhoneFormData } from './types';
import { TextInput, NumberInput, SelectInput, TextArea, CheckboxInput } from './FormFields';

interface SectionProps {
  form: PhoneFormData;
  set: <K extends keyof PhoneFormData>(key: K, value: PhoneFormData[K]) => void;
  brandOptions: Array<{ value: string; label: string }>;
}

export default function BasicInfoSection({ form, set, brandOptions }: SectionProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <SelectInput
        label="Brand"
        value={form.brand}
        onChange={(v) => set('brand', v)}
        options={brandOptions}
        required
      />
      <TextInput
        label="Model Name"
        value={form.modelName}
        onChange={(v) => set('modelName', v)}
        required
        placeholder="e.g. Galaxy S24 Ultra"
      />
      <TextInput
        label="Slug"
        value={form.slug}
        onChange={(v) => set('slug', v)}
        placeholder="auto-generated-from-brand-model"
      />
      <NumberInput
        label="Pakistani Price PKR"
        value={form.pakistaniPricePKR}
        onChange={(v) => set('pakistaniPricePKR', v)}
        placeholder="e.g. 350000"
      />
      <SelectInput
        label="PTA Status"
        value={form.ptaStatus}
        onChange={(v) => set('ptaStatus', v)}
        options={[
          { value: 'PTA Approved', label: 'PTA Approved' },
          { value: 'Non-PTA', label: 'Non-PTA' },
          { value: 'Unknown', label: 'Unknown' },
        ]}
      />
      <div className="flex items-end pb-1">
        <CheckboxInput
          label="PTA Approved"
          value={form.ptaApproved}
          onChange={(v) => set('ptaApproved', v)}
        />
      </div>
      <TextInput
        label="Release Date"
        value={form.releaseDate}
        onChange={(v) => set('releaseDate', v)}
        type="date"
      />
      <div className="md:col-span-2">
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Thumbnail</label>
        <div className="flex items-center gap-3">
          <div className="w-20 h-20 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
            {form.thumbnailUrl ? (
              <Image src={form.thumbnailUrl} alt="Thumbnail preview" width={72} height={72} className="object-contain p-1" unoptimized />
            ) : (
              <Smartphone className="w-6 h-6 text-gray-300" />
            )}
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={form.thumbnailUrl}
              onChange={e => set('thumbnailUrl', e.target.value)}
              placeholder="Paste image URL (e.g. https://fdn2.gsmarena.com/vv/bigpic/...)"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Paste a direct image URL. Preview updates automatically.</p>
          </div>
        </div>
      </div>
      <TextArea
        label="Description"
        value={form.description}
        onChange={(v) => set('description', v)}
        rows={3}
      />
      <SelectInput
        label="Status"
        value={form.status}
        onChange={(v) => set('status', v)}
        options={[
          { value: 'published', label: 'Published' },
          { value: 'draft', label: 'Draft' },
        ]}
      />
      <div className="flex flex-col gap-3">
        <CheckboxInput
          label="Featured"
          value={form.featured}
          onChange={(v) => set('featured', v)}
        />
        <CheckboxInput
          label="Trending"
          value={form.trending}
          onChange={(v) => set('trending', v)}
        />
        <CheckboxInput
          label="Upcoming"
          value={form.upcoming}
          onChange={(v) => set('upcoming', v)}
        />
      </div>
    </div>
  );
}