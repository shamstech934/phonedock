import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const constants = read('src/lib/price-source-types.ts');
const model = read('src/lib/models/PriceTracker.ts');
const api = read('src/app/api/[[...path]]/handlers/price-tracker.ts');
const ui = read('src/app/admin/price-tracker/page.tsx');

const requiredValues = [
  'retailer', 'marketplace', 'official', 'official_brand', 'reference_site',
  'distributor', 'api', 'rss_feed', 'manual',
];
const requiredLabels = [
  'Retailer', 'Marketplace', 'Official Store', 'Official Brand', 'Reference Site',
  'Distributor', 'API', 'RSS Feed', 'Manual',
];

for (const value of requiredValues) {
  if (!constants.includes(`value: '${value}'`)) throw new Error(`Missing source type value: ${value}`);
}
for (const label of requiredLabels) {
  if (!constants.includes(`label: '${label}'`)) throw new Error(`Missing source type label: ${label}`);
}
if (!model.includes('enum: PRICE_SOURCE_TYPES')) throw new Error('PriceSource model is not using shared source types.');
if (!api.includes('PRICE_SOURCE_TYPE_VALUES')) throw new Error('Price source API is not using shared source types.');
if (!ui.includes('PRICE_SOURCE_TYPE_OPTIONS')) throw new Error('Price Tracker UI is not using shared source types.');
if (!ui.includes('priceSourceSupportsAutomatedPriceTest')) throw new Error('Manual/RSS source safety behavior is missing.');

console.log(`Price source type audit passed (${requiredValues.length} source types).`);
