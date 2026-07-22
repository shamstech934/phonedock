export type PriceCategoryKey = 'entry-level' | 'budget' | 'mid-range' | 'upper-mid-range' | 'premium' | 'flagship' | 'price-unavailable';

export interface PriceCategory {
  key: PriceCategoryKey;
  label: string;
  shortLabel: string;
  min?: number;
  max?: number;
  missing?: boolean;
}

export const PRICE_CATEGORIES: readonly PriceCategory[] = [
  { key: 'entry-level', label: 'Entry Level', shortLabel: 'Under 25K', max: 24_999 },
  { key: 'budget', label: 'Budget', shortLabel: '25K – 50K', min: 25_000, max: 49_999 },
  { key: 'mid-range', label: 'Mid Range', shortLabel: '50K – 100K', min: 50_000, max: 99_999 },
  { key: 'upper-mid-range', label: 'Upper Mid Range', shortLabel: '100K – 150K', min: 100_000, max: 149_999 },
  { key: 'premium', label: 'Premium', shortLabel: '150K – 250K', min: 150_000, max: 249_999 },
  { key: 'flagship', label: 'Flagship', shortLabel: '250K+', min: 250_000 },
  { key: 'price-unavailable', label: 'Price Unavailable', shortLabel: 'Not listed', missing: true },
];

export function getPriceCategory(key?: string | null) {
  return PRICE_CATEGORIES.find(category => category.key === key);
}

export function categoryForPrice(price?: number | null): PriceCategoryKey {
  if (!Number.isFinite(price) || Number(price) <= 0) return 'price-unavailable';
  const category = PRICE_CATEGORIES.find(item => !item.missing &&
    (item.min === undefined || Number(price) >= item.min) &&
    (item.max === undefined || Number(price) <= item.max));
  return category?.key || 'flagship';
}
