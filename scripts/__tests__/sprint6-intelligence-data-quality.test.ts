import assert from 'node:assert/strict';
import { buildComparisonSummary, getAdvisorScore } from '../../src/lib/intelligence/phone-advisor';
import { buildDuplicateIndex, checkDuplicate, normalizePhoneIdentity } from '../../src/lib/import/duplicate-detector';
import type { Phone } from '../../src/components/shared/types';

const basePhone = (id: string, modelName: string, values: Partial<Phone>): Phone => ({
  id, modelName, slug: modelName.toLowerCase().replace(/\s+/g, '-'), brandId: 'b1', thumbnail: '', pricePKR: 100000,
  originalPricePKR: 0, description: '', overallRating: 0, cameraScore: 0, performanceScore: 0,
  batteryScore: 0, displayScore: 0, valueScore: 0, ptaStatus: '', ptaApproved: false,
  releaseDate: '', trending: false, upcoming: false, featured: false, ...values,
});

assert.equal(normalizePhoneIdentity('  Samsung—Galaxy S24 Ultra Smartphone 5G '), 'samsung galaxy s24 ultra');

const index = buildDuplicateIndex([{ _id: { toString: () => '1' }, slug: 'samsung-galaxy-s24-ultra', brandName: 'Samsung', modelName: 'Galaxy S24 Ultra' }]);
assert.equal(checkDuplicate({ brand: 'SAMSUNG', model: 'Galaxy S24-Ultra Smartphone', slug: 'samsung-galaxy-s24-ultra' }, index).matchType, 'exact');
assert.equal(checkDuplicate({ brand: 'Samsung', model: 'Galaxy S24 Ultra 5G', slug: 'galaxy-s24-ultra-5g' }, index).isDuplicate, true);
assert.equal(checkDuplicate({ brand: 'Apple', model: 'iPhone 16 Pro', slug: 'iphone-16-pro' }, index).isDuplicate, false);

const incomplete = basePhone('a', 'Incomplete', { performanceScore: 90 });
const complete = basePhone('b', 'Complete', { performanceScore: 85, displayScore: 88, batteryScore: 80 });
assert.ok(getAdvisorScore(complete, 'gaming').confidence > getAdvisorScore(incomplete, 'gaming').confidence);

const summary = buildComparisonSummary([incomplete, complete]);
assert.ok(summary);
assert.notEqual(summary?.verdict, 'There is not enough score data to produce a reliable recommendation.');

const emptySummary = buildComparisonSummary([basePhone('c', 'Empty A', {}), basePhone('d', 'Empty B', {})]);
assert.equal(emptySummary?.recommendedPhone, null);
assert.equal(emptySummary?.dataConfidence, 'low');

console.log('Sprint 6 intelligence/data-quality tests passed');
