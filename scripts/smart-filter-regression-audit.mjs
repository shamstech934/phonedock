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

const fallback = read('src/lib/spec-filter-fallback.ts');
expect(fallback.includes("(?:^|[^0-9])"), 'Legacy spec matching must preserve numeric token boundaries.');

const safeImage = read('src/components/shared/SafePhoneImage.tsx');
const phoneCard = read('src/components/shared/PhoneCard.tsx');
expect(safeImage.includes('fallbackLabel?: string'), 'SafePhoneImage must support an explicit fallback label.');
expect(phoneCard.includes('fallbackLabel="Image unavailable"'), 'Phone cards must identify missing images clearly.');

if (failures.length) {
  console.error('Smart filter regression audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Smart filter regression audit passed. Exact RAM/storage matching and missing-image labeling are protected.');
