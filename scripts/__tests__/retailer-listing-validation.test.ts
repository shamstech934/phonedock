import assert from 'node:assert/strict';
import { extractRetailPageTitle, validateRetailListingPage } from '../../src/lib/retailer-listing-validation';

assert.equal(
  extractRetailPageTitle('<html><head><meta property="og:title" content="Samsung Galaxy S24 Ultra 12GB 256GB PTA Approved"></head></html>'),
  'Samsung Galaxy S24 Ultra 12GB 256GB PTA Approved',
);

assert.equal(validateRetailListingPage({
  html: '<title>Samsung Galaxy S24 Ultra 12GB 256GB PTA Approved</title>',
  phoneModel: 'Galaxy S24 Ultra',
  brandName: 'Samsung',
  expectedRam: '12GB',
  expectedStorage: '256GB',
  expectedPtaStatus: 'PTA Approved',
}).valid, true);

const wrongModel = validateRetailListingPage({
  html: '<title>Samsung Galaxy A55 8GB 256GB PTA Approved</title>',
  phoneModel: 'Galaxy S24 Ultra',
  brandName: 'Samsung',
  expectedStorage: '256GB',
});
assert.equal(wrongModel.valid, false);
assert.match(wrongModel.reasons.join(' '), /does not match/i);

const wrongStorage = validateRetailListingPage({
  html: '<title>OnePlus 12 16GB 512GB PTA Approved</title>',
  phoneModel: 'OnePlus 12',
  brandName: 'OnePlus',
  expectedRam: '16GB',
  expectedStorage: '256GB',
});
assert.equal(wrongStorage.valid, false);
assert.match(wrongStorage.reasons.join(' '), /Storage variant/i);

const wrongPta = validateRetailListingPage({
  html: '<title>Google Pixel 8 Pro 128GB Non PTA</title>',
  phoneModel: 'Pixel 8 Pro',
  brandName: 'Google',
  expectedStorage: '128GB',
  expectedPtaStatus: 'PTA Approved',
});
assert.equal(wrongPta.valid, false);
assert.match(wrongPta.reasons.join(' '), /non-PTA/i);

console.log('retailer-listing-validation tests passed');

const laptopFalsePositive = validateRetailListingPage({
  html: '<title>14-inch Display Laptop 16GB 512GB</title>',
  phoneModel: '14',
  brandName: 'Xiaomi',
});
assert.equal(laptopFalsePositive.valid, false);
assert.match(laptopFalsePositive.reasons.join(' '), /does not match/i);
