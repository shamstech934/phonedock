import assert from 'node:assert/strict';
import {
  buildVerifiedPriceState,
  isPtaPriceCompatible,
  normalizePtaPriceClass,
  selectBestVerifiedOffer,
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

const offers = [
  { listingId: 'l1', sourceId: 's1', sourceName: 'Official', sourceType: 'official', sourcePriority: 100, price: 105_000, ptaStatus: 'PTA Approved', availability: 'available', enabled: true, trusted: true, sourceEnabled: true, sourceStatus: 'active', verificationStatus: 'verified' },
  { listingId: 'l2', sourceId: 's2', sourceName: 'Retailer', sourceType: 'retailer', sourcePriority: 50, price: 99_000, ptaStatus: 'PTA Approved', availability: 'available', enabled: true, trusted: true, sourceEnabled: true, sourceStatus: 'active', verificationStatus: 'verified' },
  { listingId: 'l3', sourceId: 's3', sourceName: 'Non PTA', sourceType: 'retailer', sourcePriority: 40, price: 70_000, ptaStatus: 'Non PTA', availability: 'available', enabled: true, trusted: true, sourceEnabled: true, sourceStatus: 'active', verificationStatus: 'verified' },
  { listingId: 'l4', sourceId: 's4', sourceName: 'Untrusted', sourceType: 'marketplace', sourcePriority: 0, price: 50_000, ptaStatus: 'PTA Approved', availability: 'available', enabled: true, trusted: false, sourceEnabled: true, sourceStatus: 'active', verificationStatus: 'verified' },
];
const selected = selectBestVerifiedOffer({ offers, phoneStatus: 'PTA Approved' });
assert.equal(selected.best?.listingId, 'l2');
assert.equal(selected.bestPta?.price, 99_000);
assert.equal(selected.bestNonPta?.price, 70_000);
assert.equal(selected.eligibleCount, 3);
assert.equal(selected.rejectedCount, 1);

const preferred = selectBestVerifiedOffer({ offers, phoneStatus: 'PTA Approved', preferredSourceId: 's1' });
assert.equal(preferred.best?.listingId, 'l1');

const nonPta = selectBestVerifiedOffer({ offers, phoneStatus: 'Non PTA' });
assert.equal(nonPta.best?.listingId, 'l3');

const unavailable = selectBestVerifiedOffer({
  offers: [{ ...offers[1], availability: 'unavailable' }],
  phoneStatus: 'PTA Approved',
});
assert.equal(unavailable.best, null);

console.log('Price tracker intelligence tests passed');
