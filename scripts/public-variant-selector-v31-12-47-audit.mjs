import fs from 'node:fs';
const file = fs.readFileSync(new URL('../src/app/phones/[slug]/PhoneDetailClient.tsx', import.meta.url), 'utf8');
const checks = [
  ['spec RAM fallback', "splitCatalogVariantValues(data?.phone?.specs?.ram, 'memory')"],
  ['spec storage fallback', "splitCatalogVariantValues(data?.phone?.specs?.storage, 'memory')"],
  ['spec color fallback', "splitCatalogVariantValues(data?.phone?.specs?.colors, 'color')"],
  ['merged verified/catalog variants', 'mergeVariantOptions(priceTracker?.variantOptions?.storage, specStorageOptions)'],
  ['variant UI', 'Choose variant'],
  ['exact-price safety message', 'Another storage or color price will not be substituted.'],
  ['unavailable badge safety', 'No verified price'],
];
let failed = 0;
for (const [name, needle] of checks) {
  const ok = file.includes(needle);
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log('v31.12.47 public variant selector audit passed.');
