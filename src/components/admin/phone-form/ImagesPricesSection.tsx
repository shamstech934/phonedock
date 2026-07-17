import type { PhoneFormData, PhoneImage, PhonePrice } from './types';
import { STORE_NAMES, EMPTY_IMAGE, EMPTY_PRICE } from './types';
import { FieldLabel, CheckboxInput } from './FormFields';

interface SectionProps {
  form: PhoneFormData;
  set: <K extends keyof PhoneFormData>(key: K, value: PhoneFormData[K]) => void;
}

export default function ImagesPricesSection({ form, set }: SectionProps) {
  // ── Image helpers ──
  const addImage = () => set('images', [...form.images, { ...EMPTY_IMAGE }]);

  const removeImage = (index: number) =>
    set(
      'images',
      form.images.filter((_, i) => i !== index),
    );

  const updateImage = (
    index: number,
    field: keyof PhoneImage,
    value: string,
  ) => {
    const updated = form.images.map((img, i) =>
      i === index ? { ...img, [field]: value } : img,
    );
    set('images', updated);
  };

  // ── Price helpers ──
  const addPrice = () => set('prices', [...form.prices, { ...EMPTY_PRICE }]);

  const removePrice = (index: number) =>
    set(
      'prices',
      form.prices.filter((_, i) => i !== index),
    );

  const updatePrice = (
    index: number,
    field: keyof PhonePrice,
    value: PhonePrice[keyof PhonePrice],
  ) => {
    const updated = form.prices.map((p, i) =>
      i === index ? { ...p, [field]: value } : p,
    );
    set('prices', updated);
  };

  return (
    <div className="space-y-10">
      {/* Images */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">
            Images
          </h3>
          <button
            type="button"
            onClick={addImage}
            className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Add Image
          </button>
        </div>

        {form.images.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400">
            No images added yet. Click &quot;Add Image&quot; to get started.
          </p>
        )}

        <div className="space-y-3">
          {form.images.map((img, idx) => (
            <div
              key={idx}
              className="flex items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
            >
              <div className="flex-1">
                <FieldLabel>URL</FieldLabel>
                <input
                  type="text"
                  value={img.url}
                  onChange={(e) =>
                    updateImage(idx, 'url', e.target.value)
                  }
                  placeholder="https://..."
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <FieldLabel>Alt Text</FieldLabel>
                <input
                  type="text"
                  value={img.altText}
                  onChange={(e) =>
                    updateImage(idx, 'altText', e.target.value)
                  }
                  placeholder="Description of the image"
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="mb-0.5 rounded-lg p-2 text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
                title="Remove image"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Prices */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">
            Prices
          </h3>
          <button
            type="button"
            onClick={addPrice}
            className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Add Price
          </button>
        </div>

        {form.prices.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400">
            No prices added yet. Click &quot;Add Price&quot; to get started.
          </p>
        )}

        <div className="space-y-3">
          {form.prices.map((price, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-gray-200 bg-gray-50 p-3"
            >
              <div className="flex flex-wrap items-end gap-3">
                {/* Store Name */}
                <div className="min-w-[140px]">
                  <FieldLabel>Store</FieldLabel>
                  <select
                    value={price.storeName}
                    onChange={(e) =>
                      updatePrice(idx, 'storeName', e.target.value)
                    }
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {STORE_NAMES.map((store) => (
                      <option key={store} value={store}>
                        {store}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price */}
                <div className="min-w-[140px] flex-1">
                  <FieldLabel>Price (PKR)</FieldLabel>
                  <input
                    type="number"
                    value={price.price === '' ? '' : price.price}
                    onChange={(e) => {
                      const raw = e.target.value;
                      updatePrice(
                        idx,
                        'price',
                        raw === '' ? '' : Number(raw),
                      );
                    }}
                    placeholder="e.g. 349999"
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* URL */}
                <div className="min-w-[200px] flex-1">
                  <FieldLabel>URL</FieldLabel>
                  <input
                    type="text"
                    value={price.url}
                    onChange={(e) =>
                      updatePrice(idx, 'url', e.target.value)
                    }
                    placeholder="https://..."
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* In Stock */}
                <div className="flex items-end pb-0.5">
                  <CheckboxInput
                    label="In Stock"
                    value={price.inStock}
                    onChange={(v) => updatePrice(idx, 'inStock', v)}
                  />
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removePrice(idx)}
                  className="mb-0.5 rounded-lg p-2 text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
                  title="Remove price"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Price Tracking Settings */}
      <section>
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Price Tracking
        </h3>
        <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          {/* Price Mode */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Price Mode
            </label>
            <select
              value={form.priceMode}
              onChange={(e) =>
                set(
                  'priceMode',
                  e.target.value as 'manual' | 'automatic',
                )
              }
              className="mt-1 block w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="manual">Manual</option>
              <option value="automatic">Automatic (from sources)</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Manual mode means prices are set by admins. Automatic mode means prices are updated from retail sources.
            </p>
          </div>

          {/* Manual Lock */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={form.manualLock}
                onChange={(e) => set('manualLock', e.target.checked)}
                className="peer sr-only"
              />
              <div className="h-6 w-11 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500"></div>
            </label>
            <div>
              <span className="text-sm font-medium text-gray-700">
                Lock Manual Price
              </span>
              <p className="text-xs text-gray-400">
                When locked, automatic price updates from sources will be ignored for this phone.
              </p>
            </div>
          </div>

          {form.manualLock && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Lock Reason
              </label>
              <input
                type="text"
                value={form.manualLockReason}
                onChange={(e) =>
                  set('manualLockReason', e.target.value)
                }
                placeholder="e.g. Verified market price, promotional price"
                className="mt-1 block w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          )}

          {/* Source URL (optional) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Price Source URL{' '}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <input
              type="url"
              value={form.priceSourceUrl}
              onChange={(e) =>
                set('priceSourceUrl', e.target.value)
              }
              placeholder="https://example.com/phone-product-page"
              className="mt-1 block w-full max-w-lg rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-400">
              Optional product page URL. Must use HTTPS. Used for automatic price tracking.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}