import assert from 'node:assert/strict';
import {
  findTrustedSourceForUrl,
  normalizePendingCollectedPrice,
  resolveCollectorPhoneTarget,
} from '../../src/lib/collector-price-bridge';
import { isProbableProductUrl } from '../../src/lib/price-catalog-discovery';

const approvedId = '64b000000000000000000001';
const importedId = '64b000000000000000000002';
const duplicateId = '64b000000000000000000003';

assert.deepEqual(
  resolveCollectorPhoneTarget({ approvedPhoneId: approvedId }),
  { phoneId: approvedId, strategy: 'direct_approval', confidence: 100 },
  'an explicit approved phone must be preferred',
);

assert.deepEqual(
  resolveCollectorPhoneTarget({ importedPhoneId: importedId }),
  { phoneId: importedId, strategy: 'imported', confidence: 100 },
  'an imported phone may be bridged',
);

assert.deepEqual(
  resolveCollectorPhoneTarget({
    duplicatePhoneId: duplicateId,
    hasExactDuplicate: true,
    duplicateMatches: [{ type: 'exact_slug', phoneId: duplicateId, confidence: 0.98 }],
  }),
  { phoneId: duplicateId, strategy: 'exact_duplicate', confidence: 95 },
  'a high-confidence exact slug duplicate may be bridged',
);

assert.equal(
  resolveCollectorPhoneTarget({
    duplicatePhoneId: duplicateId,
    duplicateMatches: [{ type: 'fuzzy', phoneId: duplicateId, confidence: 0.99 }],
  }),
  null,
  'a fuzzy match must never be auto-linked',
);

assert.equal(isProbableProductUrl('https://example.com/smartphones'), false, 'catalog pages are not product URLs');
assert.equal(isProbableProductUrl('https://example.com/smartphones/galaxy-s24-ultra'), true, 'model pages are product URLs');

const sources = [
  { _id: 'trusted', allowedDomains: ['priceoye.pk'] },
  { _id: 'other', allowedDomains: ['example.com'] },
];
assert.equal(
  findTrustedSourceForUrl('https://www.priceoye.pk/mobiles/samsung/samsung-galaxy-s24', sources)?._id,
  'trusted',
  'www and subdomains should match the allowlist safely',
);
assert.equal(
  findTrustedSourceForUrl('https://priceoye.pk.attacker.example/mobiles/galaxy-s24', sources),
  null,
  'lookalike domains must not match',
);

assert.equal(normalizePendingCollectedPrice('149999.4'), 149999, 'valid collected prices are normalized for pending review');
assert.equal(normalizePendingCollectedPrice(-1), 0, 'invalid prices are ignored');
assert.equal(normalizePendingCollectedPrice(Number.NaN), 0, 'NaN prices are ignored');

console.log('collector-price-bridge tests passed');
