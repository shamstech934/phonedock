import assert from 'node:assert/strict';
import { buildSmartComparison, rankComparisonCategory } from '../../src/lib/intelligence/compare-engine';
import type { Phone } from '../../src/components/shared/types';

const phone = (id: string, overrides: Partial<Phone>): Phone => ({
  id, modelName: id, slug: id, brandId: 'b', thumbnail: '', pricePKR: 100000,
  originalPricePKR: 0, description: '', overallRating: 8, cameraScore: 70,
  performanceScore: 70, batteryScore: 70, displayScore: 70, valueScore: 70,
  ptaStatus: 'Approved', ptaApproved: true, releaseDate: '', trending: false,
  upcoming: false, featured: false, ...overrides,
});

const camera = phone('camera-phone', { cameraScore: 96, performanceScore: 60 });
const gaming = phone('gaming-phone', { performanceScore: 97, displayScore: 92, batteryScore: 85 });
const value = phone('value-phone', { valueScore: 94, pricePKR: 55000 });

assert.equal(rankComparisonCategory([camera, gaming, value], 'camera').phone?.id, 'camera-phone');
assert.equal(rankComparisonCategory([camera, gaming, value], 'gaming').phone?.id, 'gaming-phone');
assert.equal(rankComparisonCategory([camera, gaming, value], 'value').phone?.id, 'value-phone');

const result = buildSmartComparison([camera, gaming, value]);
assert.ok(result);
assert.equal(result?.insights.length, 3);
assert.ok(result?.verdict.length);

const tied = rankComparisonCategory([phone('a', {}), phone('b', {})], 'display');
assert.equal(tied.tie, true);
assert.equal(tied.phone, null);
console.log('compare-engine-v5.2 tests passed');
