import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const variant = read('src/lib/price-variant.ts');
const bridge = read('src/lib/collector-price-bridge.ts');
const catalog = read('src/lib/price-catalog-sync.ts');
const cron = read('src/app/api/[[...path]]/handlers/cron-update-prices.ts');
const tracker = read('src/app/api/[[...path]]/handlers/price-tracker.ts');

assert.match(variant, /inferRetailVariantIdentity/);
assert.match(variant, /inferUniqueMemoryLabel/);
assert.match(bridge, /variantKey:\s*variant\.variantKey/);
assert.match(bridge, /inferUniqueMemoryLabel\(record\.memory\?\.storage\)/);
assert.match(catalog, /PTA class is not explicit/);
assert.doesNotMatch(catalog, /listingStatus:\s*listing\.ptaStatus/);
assert.match(catalog, /variantKey:\s*variant\.variantKey/);
assert.match(cron, /resolvedVariant = inferRetailVariantIdentity/);
assert.match(cron, /PTA class is not explicit/);
assert.doesNotMatch(cron, /PTA and Non-PTA price variants cannot be mixed automatically/);
assert.match(tracker, /const variant = inferRetailVariantIdentity/);
assert.match(tracker, /variantKey:\s*variant\.variantKey/);
console.log('Variant price population static audit passed');
