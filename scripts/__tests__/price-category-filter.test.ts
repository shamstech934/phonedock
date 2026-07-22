import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PRICE_CATEGORIES, categoryForPrice, getPriceCategory } from '../../src/lib/price-categories';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

assert.equal(PRICE_CATEGORIES.length, 7);
assert.equal(categoryForPrice(undefined), 'price-unavailable');
assert.equal(categoryForPrice(null), 'price-unavailable');
assert.equal(categoryForPrice(0), 'price-unavailable');
assert.equal(categoryForPrice(24_999), 'entry-level');
assert.equal(categoryForPrice(25_000), 'budget');
assert.equal(categoryForPrice(49_999), 'budget');
assert.equal(categoryForPrice(50_000), 'mid-range');
assert.equal(categoryForPrice(99_999), 'mid-range');
assert.equal(categoryForPrice(100_000), 'upper-mid-range');
assert.equal(categoryForPrice(149_999), 'upper-mid-range');
assert.equal(categoryForPrice(150_000), 'premium');
assert.equal(categoryForPrice(249_999), 'premium');
assert.equal(categoryForPrice(250_000), 'flagship');
assert.equal(getPriceCategory('invalid'), undefined);

const client = read('src/app/phones/PhonesClient.tsx');
assert.match(client, /searchParams\.get\('priceCategory'\)/);
assert.match(client, /lg:grid-cols-\[220px_minmax\(0,1fr\)\]/);
assert.match(client, /aria-label="Price categories"/);
assert.match(client, /lg:hidden/);
assert.match(client, /params\.delete\('price'\)/);

const listing = read('src/lib/fetch-public-listings.ts');
assert.match(listing, /getPriceCategory\(params\.priceCategory\)/);
assert.match(listing, /apiParams\.set\('priceMissing', 'true'\)/);
assert.match(listing, /filter\.\$and/);

const api = read('src/app/api/[[...path]]/handlers/public.ts');
assert.match(api, /priceMissing/);
assert.match(api, /pricePKR: \{ \$exists: false \}/);

console.log('Price category filter tests passed');
