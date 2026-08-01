export type SeoSpecLanding = {
  type: 'ram' | 'storage' | 'camera' | 'battery' | 'refresh' | 'chipset' | 'feature';
  value: string;
  label: string;
  title: string;
  description: string;
  query: Record<string, string>;
};

export const SEO_SPEC_LANDINGS: SeoSpecLanding[] = [
  ...['4','6','8','12','16'].map((value) => ({ type: 'ram' as const, value, label: `${value}GB RAM Phones`, title: `${value}GB RAM Phones Price in Pakistan 2026`, description: `Compare ${value}GB RAM smartphones available in Pakistan with latest prices, specifications, PTA status and reviews.`, query: { ramMin: value, ramMax: value } })),
  ...['64','128','256','512','1024'].map((value) => ({ type: 'storage' as const, value, label: value === '1024' ? '1TB Phones' : `${value}GB Phones`, title: `${value === '1024' ? '1TB' : `${value}GB`} Storage Phones in Pakistan 2026`, description: `Browse phones with ${value === '1024' ? '1TB' : `${value}GB`} storage in Pakistan and compare current prices, specs and PTA status.`, query: { storageMin: value, storageMax: value } })),
  ...['50','108','200'].map((value) => ({ type: 'camera' as const, value, label: `${value}MP Camera Phones`, title: `${value}MP Camera Phones Price in Pakistan 2026`, description: `Find ${value}MP camera phones in Pakistan with prices, camera specifications, ratings and comparisons.`, query: { cameraMin: value } })),
  { type: 'battery', value: '5000', label: '5000mAh Battery Phones', title: '5000mAh Battery Phones in Pakistan 2026', description: 'Compare smartphones with 5000mAh or larger batteries, current Pakistan prices and complete specifications.', query: { batteryMin: '5000' } },
  { type: 'refresh', value: '120', label: '120Hz Display Phones', title: '120Hz Display Phones Price in Pakistan 2026', description: 'Browse phones with 120Hz or faster displays and compare prices, specifications and ratings in Pakistan.', query: { refreshMin: '120' } },
  { type: 'feature', value: '5g', label: '5G Phones', title: '5G Phones Price in Pakistan 2026', description: 'Latest 5G phones available in Pakistan with current prices, complete specifications and PTA information.', query: { '5g': 'yes' } },
  { type: 'feature', value: 'pta-approved', label: 'PTA Approved Phones', title: 'PTA Approved Phones Price in Pakistan 2026', description: 'Browse PTA approved smartphones in Pakistan with current prices, specifications and comparisons.', query: { pta: 'approved' } },
  ...['snapdragon','dimensity','mediatek','exynos','tensor'].map((value) => ({ type: 'chipset' as const, value, label: `${value[0].toUpperCase()}${value.slice(1)} Phones`, title: `${value[0].toUpperCase()}${value.slice(1)} Phones Price in Pakistan 2026`, description: `Compare ${value} powered phones in Pakistan with prices, performance specifications and ratings.`, query: { chipset: value } })),
];

export function findSeoSpecLanding(type: string, value: string) {
  return SEO_SPEC_LANDINGS.find((item) => item.type === type && item.value === value);
}
