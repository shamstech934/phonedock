import fs from 'node:fs';

const checks: Array<[string, boolean]> = [
  ['wishlist page exists', fs.existsSync('src/app/wishlist/page.tsx')],
  ['recent page exists', fs.existsSync('src/app/recently-viewed/page.tsx')],
  ['storage uses versioned wishlist key', fs.readFileSync('src/lib/personalization/storage.ts', 'utf8').includes('pd_wishlist_v1')],
  ['recent list is capped', fs.readFileSync('src/lib/personalization/storage.ts', 'utf8').includes('MAX_RECENT = 18')],
  ['phone cards expose wishlist action', fs.readFileSync('src/components/shared/PhoneCard.tsx', 'utf8').includes('Add to wishlist')],
  ['phone detail records recent views', fs.readFileSync('src/app/phones/[slug]/PhoneDetailClient.tsx', 'utf8').includes('recent.add(data.phone)')],
  ['compare supports six phones', fs.readFileSync('src/app/compare/page.tsx', 'utf8').includes('selected.length < 6')],
];
let passed = 0;
for (const [label, ok] of checks) {
  if (!ok) throw new Error(`Failed: ${label}`);
  console.log(`✓ ${label}`);
  passed++;
}
console.log(`\nPersonalization feature: ${passed}/${checks.length} checks passed`);
