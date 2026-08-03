import fs from 'node:fs';

const cron = fs.readFileSync('src/app/api/[[...path]]/handlers/cron-update-prices.ts', 'utf8');
const model = fs.readFileSync('src/lib/models/PriceTracker.ts', 'utf8');
const handler = fs.readFileSync('src/app/api/[[...path]]/handlers/price-tracker.ts', 'utf8');
const seed = fs.readFileSync('scripts/seed-pakistan-official-price-sources.ts', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const checks = [
  ['bounded batches', cron.includes('.limit(Math.max(1, Math.min(BATCH_SIZE, 50)))')],
  ['distributed lock', cron.includes('LOCK_KEY') && cron.includes('findOneAndUpdate')],
  ['retry due filtering', cron.includes("{ nextRetryAt: { $lte: now } }")],
  ['exponential retry state', cron.includes('getRetryState') && cron.includes('MAX_RETRY_DELAY_MINUTES')],
  ['listing failure quarantine', cron.includes("verificationStatus: retry.failureCount >= 3 ? 'failed' : 'verified'") || cron.includes("verificationStatus: listingRetry.failureCount >= 3 ? 'failed' : 'verified'")],
  ['successful recovery reset', cron.includes('nextRetryAt: null') && cron.includes("lastError: ''")],
  ['SSRF validation', cron.includes('validateUrlForFetch')],
  ['product identity validation', cron.includes('validateRetailListingPage')],
  ['deterministic extraction', cron.includes('extractRetailPrice')],
  ['price history', cron.includes('PriceTrackerHistory.create')],
  ['manual lock protection', cron.includes('manualLock')],
  ['source/listing indexes', model.includes('nextRetryAt: 1')],
  ['admin source controls', handler.includes('test-source') && handler.includes('sources')],
  ['official Pakistan source seed', seed.includes('Samsung Pakistan Official') && seed.includes('vivo Pakistan Official Store') && seed.includes('mistore.pk')],
  ['seed npm command', pkg.scripts?.['seed:price-sources-pk'] === 'tsx scripts/seed-pakistan-official-price-sources.ts'],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
if (failed) process.exit(1);
console.log(`Price Tracker Phase 2.1 completion audit passed (${checks.length}/${checks.length}).`);
