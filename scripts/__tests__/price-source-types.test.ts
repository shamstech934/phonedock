import assert from 'node:assert/strict';
import { PRICE_SOURCE_TYPES, PRICE_SOURCE_TYPE_OPTIONS, getPriceSourceTypeLabel, normalizePriceSourceType, priceSourceSupportsAutomatedPriceTest } from '../../src/lib/price-source-types';

const expected = [
  'retailer',
  'marketplace',
  'official',
  'official_brand',
  'reference_site',
  'distributor',
  'api',
  'rss_feed',
  'manual',
];

assert.deepEqual([...PRICE_SOURCE_TYPES], expected);
assert.equal(PRICE_SOURCE_TYPE_OPTIONS.length, 9);
assert.equal(getPriceSourceTypeLabel('reference_site'), 'Reference Site');
assert.equal(getPriceSourceTypeLabel('official'), 'Official Store');
assert.equal(getPriceSourceTypeLabel('unknown-type'), 'unknown-type');
assert.equal(normalizePriceSourceType('reference_site'), 'reference_site');
assert.equal(normalizePriceSourceType('invalid'), 'retailer');
assert.equal(priceSourceSupportsAutomatedPriceTest('manual'), false);
assert.equal(priceSourceSupportsAutomatedPriceTest('rss_feed'), false);
assert.equal(priceSourceSupportsAutomatedPriceTest('api'), true);

console.log('Price source types regression checks passed.');
