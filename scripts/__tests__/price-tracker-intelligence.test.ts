import assert from 'node:assert/strict';
import {
  buildVerifiedPriceState,
  isPtaPriceCompatible,
  normalizePtaPriceClass,
} from '../../src/lib/price-tracker-intelligence';

assert.equal(normalizePtaPriceClass('PTA Approved'), 'pta-approved');
assert.equal(normalizePtaPriceClass('Non PTA'), 'non-pta');
assert.equal(normalizePtaPriceClass('', false), 'unknown');

assert.equal(isPtaPriceCompatible({ phoneStatus: 'PTA Approved', listingStatus: 'Non PTA' }), false);
assert.equal(isPtaPriceCompatible({ phoneStatus: 'Non-PTA', listingStatus: 'PTA Approved' }), false);
assert.equal(isPtaPriceCompatible({ phoneStatus: 'PTA Approved', listingStatus: '' }), true);
assert.equal(isPtaPriceCompatible({ phoneStatus: 'Unknown', listingStatus: 'Non PTA' }), true);

const drop = buildVerifiedPriceState({ currentPrice: 100_000, nextPrice: 85_000 });
assert.equal(drop.previousPrice, 100_000);
assert.equal(drop.originalPrice, 100_000);
assert.equal(drop.difference, -15_000);
assert.equal(drop.percentageChange, -15);
assert.equal(drop.discountPercent, 15);
assert.equal(drop.direction, 'decrease');
assert.equal(drop.qualifiesForPriceDropTrend, true);

const furtherDrop = buildVerifiedPriceState({ currentPrice: 85_000, nextPrice: 80_000, originalPrice: 100_000 });
assert.equal(furtherDrop.originalPrice, 100_000);
assert.equal(furtherDrop.discountPercent, 20);

const recovered = buildVerifiedPriceState({ currentPrice: 85_000, nextPrice: 100_000, originalPrice: 100_000 });
assert.equal(recovered.originalPrice, 0);
assert.equal(recovered.discountPercent, 0);
assert.equal(recovered.direction, 'increase');

const initial = buildVerifiedPriceState({ currentPrice: 0, nextPrice: 50_000 });
assert.equal(initial.direction, 'initial');
assert.equal(initial.originalPrice, 0);
assert.equal(initial.qualifiesForPriceDropTrend, false);

assert.throws(() => buildVerifiedPriceState({ currentPrice: 50_000, nextPrice: 0 }));

console.log('Price tracker intelligence tests passed');
