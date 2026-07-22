import assert from 'node:assert/strict';
import { generatePhoneReview } from '../../src/lib/intelligence/review-engine';

const flagship = generatePhoneReview({
  modelName: 'PhoneDock Test Pro', pricePKR: 149999,
  specs: {
    chipset: 'Snapdragon 8 Gen 3', ramGB: 12, displayType: 'LTPO AMOLED',
    refreshRate: '120Hz', mainCamera: '50 MP with OIS', ois: 'Yes', telephoto: '3x optical',
    ultrawide: '12 MP', batteryMAh: 5500, chargingSpeed: '100W', os: 'Android 15',
    updatePolicy: '5 years', ipRating: 'IP68', storageGB: 256,
  },
});
assert.equal(flagship.engineVersion, 'review-v2');
assert.ok(flagship.scores.overall >= 7.5);
assert.ok(flagship.scores.performance >= 8);
assert.ok(flagship.pros.length > 0);
assert.ok(flagship.quickSummary.includes('PhoneDock Test Pro'));
assert.ok(flagship.confidence >= 50 && flagship.confidence <= 98);

const incomplete = generatePhoneReview({ modelName: 'Unknown Basic' });
assert.ok(incomplete.confidence < flagship.confidence);
assert.ok(incomplete.fullSummary.includes('not fabricated'));
assert.ok(['buy', 'consider', 'skip'].includes(incomplete.recommendation));

const deterministic = generatePhoneReview({ modelName: 'Unknown Basic' });
assert.deepEqual(incomplete, deterministic);
console.log('v5.4 review engine tests passed');
