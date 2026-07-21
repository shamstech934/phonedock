import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MAX_COMPARE_PHONES, normalizeCompareValues, canAddComparePhone } from '../../src/lib/compare';

const checks: Array<[string, () => void]> = [
  ['wishlist page exists', () => assert.equal(fs.existsSync('src/app/wishlist/page.tsx'), true)],
  ['recent page exists', () => assert.equal(fs.existsSync('src/app/recently-viewed/page.tsx'), true)],
  ['storage uses versioned wishlist key', () => assert.match(fs.readFileSync('src/lib/personalization/storage.ts', 'utf8'), /pd_wishlist_v1/)],
  ['recent list is capped', () => assert.match(fs.readFileSync('src/lib/personalization/storage.ts', 'utf8'), /MAX_RECENT\s*=\s*18/)],
  ['phone cards expose wishlist action', () => assert.match(fs.readFileSync('src/components/shared/PhoneCard.tsx', 'utf8'), /Add to wishlist/)],
  ['phone detail records recent views', () => assert.match(fs.readFileSync('src/app/phones/[slug]/PhoneDetailClient.tsx', 'utf8'), /recent\.add\(data\.phone\)/)],
  ['compare supports six phones behaviorally', () => {
    assert.equal(MAX_COMPARE_PHONES, 6);
    assert.deepEqual(normalizeCompareValues('a,b,c,d,e,f,g'), ['a', 'b', 'c', 'd', 'e', 'f']);
    assert.equal(canAddComparePhone(5), true);
    assert.equal(canAddComparePhone(6), false);
  }],
];

let passed = 0;
for (const [label, check] of checks) {
  check();
  console.log(`✓ ${label}`);
  passed++;
}
console.log(`
Personalization feature: ${passed}/${checks.length} checks passed`);
