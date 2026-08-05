import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectRetailAvailability, isCatalogDiscoveryDue } from '../../src/lib/price-catalog-sync';

const now = new Date('2026-08-06T12:00:00.000Z');

assert.equal(isCatalogDiscoveryDue('manual', null, now), false, 'manual sources must never run automatically');
assert.equal(isCatalogDiscoveryDue('daily', null, now), true, 'a never-run daily source must be due');
assert.equal(isCatalogDiscoveryDue('hourly', new Date('2026-08-06T10:59:59.000Z'), now), true);
assert.equal(isCatalogDiscoveryDue('hourly', new Date('2026-08-06T11:30:00.000Z'), now), false);
assert.equal(isCatalogDiscoveryDue('daily', new Date('2026-08-05T11:59:59.000Z'), now), true);
assert.equal(isCatalogDiscoveryDue('daily', new Date('2026-08-06T11:59:59.000Z'), now), false);
assert.equal(isCatalogDiscoveryDue('weekly', new Date('2026-07-30T11:59:59.000Z'), now), true);

assert.equal(detectRetailAvailability('<button>Add to cart</button>'), 'available');
assert.equal(detectRetailAvailability('<p>Sold out</p><button>Add to cart</button>'), 'unavailable');
assert.equal(detectRetailAvailability('<h1>Galaxy S26</h1>'), 'unknown');

const root = join(__dirname, '..', '..');
const cronSource = readFileSync(join(root, 'src/app/api/[[...path]]/handlers/cron-update-prices.ts'), 'utf8');
const syncSource = readFileSync(join(root, 'src/lib/price-catalog-sync.ts'), 'utf8');

assert.match(cronSource, /discoverDuePriceListings\(now\)/, 'daily price cron must run due catalog discovery');
assert.match(cronSource, /verifyPendingCatalogListings\(now\)/, 'daily price cron must verify pending catalog links');
assert.match(syncSource, /MAX_SOURCES_PER_RUN = 2/, 'catalog work must stay bounded per invocation');
assert.match(syncSource, /MAX_PENDING_VERIFICATIONS_PER_RUN = 8/, 'verification work must stay bounded per invocation');
assert.match(syncSource, /validateUrlForFetch\(listing\.productUrl/, 'product fetches must retain SSRF protection');
assert.match(syncSource, /matchConfidence: \{ \$gte: 80 \}/, 'only high-confidence automatic matches may be verified');
assert.match(syncSource, /extracted\.confidence < 0\.7/, 'low-confidence prices must not be promoted');
assert.match(syncSource, /currentSourcePrice: 0/, 'verification must leave canonical price/history writes to regular sync');

console.log('price-auto-tracking tests passed');
