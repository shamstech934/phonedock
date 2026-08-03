import fs from 'node:fs';
const api = fs.readFileSync('src/app/api/[[...path]]/handlers/price-tracker.ts','utf8');
const ui = fs.readFileSync('src/app/admin/price-tracker/page.tsx','utf8');
const cron = fs.readFileSync('src/app/api/[[...path]]/handlers/cron-update-prices.ts','utf8');
const checks = [
 ['catalog includes all published phones', api.includes("{ active: true, status: 'published' }")],
 ['listing state joined into phone catalog', api.includes('listingByPhone') && api.includes("verificationStatus: listing?.verificationStatus || 'unlinked'")],
 ['frontend phone DTO keys returned', api.includes('phoneName: p.modelName') && api.includes('phoneId: p._id.toString()')],
 ['unlinked count is explicit', api.includes('unlinkedPhones: Math.max')],
 ['auto-link requires trusted sources', api.includes('trusted: true') && api.includes("segments[2] === 'auto-link'")],
 ['sync is bounded', cron.includes('.limit(Math.max(1, Math.min(BATCH_SIZE, 50)))')],
 ['retry queue exists', cron.includes('nextRetryAt') && cron.includes('getRetryState')],
 ['history is recorded', cron.includes('PriceTrackerHistory.create')],
 ['pending review threshold exists', cron.includes('REVIEW_THRESHOLD')],
 ['manual and cron share engine', cron.includes('return (await handleCronUpdatePrices(internalRequest))')],
 ['UI refreshes all tracker data after sync', ui.includes('fetchChanges(), fetchPending()')],
 ['empty catalog message is honest', ui.includes('No published phones matched the current filters.')],
];
let passed=0;
for (const [name, ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(ok) passed++; }
console.log(`\n${passed}/${checks.length} passed`);
if (passed !== checks.length) process.exit(1);
