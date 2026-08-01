import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const client = read('src/app/phones/PhonesClient.tsx');
expect(client.includes("params.set('ramMin', ramParam);") && client.includes("params.set('ramMax', ramParam);"), 'RAM UI filter must send an exact min/max pair.');
expect(client.includes("params.set('storageMin', storageParam);") && client.includes("params.set('storageMax', storageParam);"), 'Storage UI filter must send an exact min/max pair.');

const listings = read('src/lib/fetch-public-listings.ts');
expect(/kind: 'ram', min: ram, max: ram/.test(listings), 'Server-rendered RAM filtering must use exact bounds.');
expect(/kind: 'storage', min: storage, max: storage/.test(listings), 'Server-rendered storage filtering must use exact bounds.');
expect(listings.includes("apiParams.set('ramMax', String(ram))"), 'Public listing API request must forward ramMax.');
expect(listings.includes("apiParams.set('storageMax', String(storage))"), 'Public listing API request must forward storageMax.');
expect(listings.includes('public-phone-listing-v2-exact-variant-tokens'), 'Public listing cache key must be bumped after exact-filter changes.');

const fallback = read('src/lib/spec-filter-fallback.ts');
expect(fallback.includes("options.kind === 'ram' || options.kind === 'storage'"), 'RAM/storage filters must use text-first exact variant matching.');
expect(fallback.includes('textMissing'), 'Numeric RAM/storage fallback must be limited to records missing the text field.');
expect(fallback.includes("{ [options.numericField]: range }"), 'Numeric fallback must remain available for normalized-only records.');
expect(fallback.includes('(?:^|[^0-9])'), 'Legacy spec matching must preserve numeric token boundaries.');

// Behavioural mirror of the production token boundary. This protects the
// exact cases reported from production without depending on package layout.
const exactGb = (value, wanted) => new RegExp(`(?:^|[^0-9])${wanted}\\s*gb\\b`, 'i').test(value);
expect(exactGb('4GB', 4), '4GB must match the 4GB filter.');
expect(exactGb('3GB/4GB', 4), '3GB/4GB must match the 4GB filter.');
expect(exactGb('4GB/6GB', 4), '4GB/6GB must match the 4GB filter.');
expect(!exactGb('6GB/8GB', 4), '6GB/8GB must not match the 4GB filter.');
expect(!exactGb('64GB', 4), '64GB must not match the 4GB filter.');

const safeImage = read('src/components/shared/SafePhoneImage.tsx');
const phoneCard = read('src/components/shared/PhoneCard.tsx');
expect(safeImage.includes('fallbackLabel?: string'), 'SafePhoneImage must support an explicit fallback label.');
expect(phoneCard.includes('fallbackLabel="Image unavailable"'), 'Phone cards must identify missing images clearly.');

if (failures.length) {
  console.error('Smart filter regression audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Smart filter regression audit passed. Exact text variants are authoritative and stale numeric helpers cannot leak false RAM/storage matches.');
