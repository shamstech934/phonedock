import fs from 'node:fs';

const client = fs.readFileSync('src/app/phones/PhonesClient.tsx', 'utf8');
const listing = fs.readFileSync('src/lib/fetch-public-listings.ts', 'utf8');
const image = fs.readFileSync('src/components/shared/SafePhoneImage.tsx', 'utf8');
const card = fs.readFileSync('src/components/shared/PhoneCard.tsx', 'utf8');

const checks = [
  ['debounced search', client.includes("window.setTimeout(() => updateParam('q', normalized), 350)")],
  ['search clear control', client.includes('Clear phone search')],
  ['page size options', client.includes('PAGE_SIZE_OPTIONS = [12, 20, 32]')],
  ['server page size support', listing.includes("[12, 20, 32].includes(requestedLimit)")],
  ['out of range page recovery', client.includes('pageParam > totalPages')],
  ['image source reset', image.includes('useEffect(() =>') && image.includes('setBroken(!normalized')],
  ['accessible image fallback', image.includes('image unavailable`}') || image.includes('image unavailable`')],
  ['spec value tooltips', card.includes('title={phone.specs.chipset}') && card.includes('title={phone.specs.storage}')],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) failed += 1;
}
if (failed) process.exit(1);
console.log(`Phone listing audit passed: ${checks.length}/${checks.length}`);
