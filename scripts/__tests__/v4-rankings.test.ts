import assert from 'node:assert/strict';
import { rankPhones } from '../../src/lib/intelligence/rankings';
import type { Phone } from '../../src/components/shared/types';

const base = (overrides: Partial<Phone>): Phone => ({
  id: 'x', modelName: 'Phone', slug: 'phone', brandId: 'b', thumbnail: '', pricePKR: 50000,
  originalPricePKR: 0, description: '', overallRating: 8, cameraScore: 70,
  performanceScore: 70, batteryScore: 70, displayScore: 70, valueScore: 70,
  ptaStatus: 'Approved', ptaApproved: true, releaseDate: '', trending: false,
  upcoming: false, featured: false, ...overrides,
});

const phones = [
  base({ id: 'a', modelName: 'Alpha', slug: 'alpha', performanceScore: 95, pricePKR: 100000 }),
  base({ id: 'b', modelName: 'Beta', slug: 'beta', performanceScore: 80, pricePKR: 60000 }),
];

const gaming = rankPhones(phones, 'gaming');
assert.equal(gaming[0].phone.id, 'a');
assert.equal(gaming[0].rank, 1);
assert.ok(gaming[0].confidence > 0);

const budget = rankPhones(phones, 'budget');
assert.equal(budget[0].phone.id, 'b');
assert.match(budget[0].reason, /ranks #1/);

console.log('PhoneDock v4 ranking tests passed');
