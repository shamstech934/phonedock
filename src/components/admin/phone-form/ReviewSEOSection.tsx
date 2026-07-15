import type { PhoneFormData } from './types';
import { TextInput, TextArea } from './FormFields';

interface SectionProps {
  form: PhoneFormData;
  set: <K extends keyof PhoneFormData>(key: K, value: PhoneFormData[K]) => void;
}

export default function ReviewSEOSection({ form, set }: SectionProps) {
  return (
    <div className="grid grid-cols-1 gap-5">
      <TextArea
        label="Pros"
        value={form.pros}
        onChange={(v) => set('pros', v)}
        rows={3}
      />
      <TextArea
        label="Cons"
        value={form.cons}
        onChange={(v) => set('cons', v)}
        rows={3}
      />
      <TextArea
        label="Review Summary"
        value={form.reviewSummary}
        onChange={(v) => set('reviewSummary', v)}
        rows={4}
      />
      <TextArea
        label="Review Verdict"
        value={form.reviewVerdict}
        onChange={(v) => set('reviewVerdict', v)}
        rows={3}
      />

      <hr className="col-span-full border-gray-200" />

      <div className="col-span-full">
        <TextInput
          label="SEO Title"
          value={form.seoTitle}
          onChange={(v) => set('seoTitle', v)}
          placeholder="Meta title for search engines"
        />
      </div>
      <TextArea
        label="SEO Description"
        value={form.seoDescription}
        onChange={(v) => set('seoDescription', v)}
        rows={2}
      />
      <div className="col-span-full">
        <TextInput
          label="Keywords"
          value={form.keywords}
          onChange={(v) => set('keywords', v)}
          placeholder="comma-separated, e.g. samsung, galaxy, s24, ultra"
        />
      </div>
    </div>
  );
}