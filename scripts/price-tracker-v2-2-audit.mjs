import fs from 'node:fs';

const files = {
  handler: fs.readFileSync('src/app/api/[[...path]]/handlers/price-tracker.ts', 'utf8'),
  cron: fs.readFileSync('src/app/api/[[...path]]/handlers/cron-update-prices.ts', 'utf8'),
  page: fs.readFileSync('src/app/admin/price-tracker/page.tsx', 'utf8'),
  sources: fs.readFileSync('src/lib/pakistan-price-sources.ts', 'utf8'),
};

const checks = [
  ['deployment bootstrap endpoint', files.handler.includes("segments[2] === 'bootstrap'")],
  ['shared Pakistan official source registry', files.sources.includes('PAKISTAN_OFFICIAL_PRICE_SOURCES')],
  ['nine Pakistan official source definitions', (files.sources.match(/name: '/g) || []).length === 9],
  ['one-click setup UI', files.page.includes('Setup Pakistan sources')],
  ['legacy PhonePrice URL migration', files.handler.includes('legacyUrlsByPhone') && files.handler.includes('PhonePrice.find')],
  ['trusted-domain auto-link safety', files.handler.includes('No enabled trusted source with allowed domains exists')],
  ['tracked phone count uses listings', files.handler.includes('monitoredPhones: trackedPhoneIds.length')],
  ['failed checks include listing failures', files.handler.includes('failedListings + failedSources')],
  ['successful run state persistence', files.cron.includes("LAST_RUN_KEY = 'price_tracker_last_run'")],
  ['last successful update reads run state', files.handler.includes('lastRunState?.metadata')],
  ['manual sync uses protected cron engine', files.cron.includes('handleAdminRunPriceSync') && files.cron.includes("headers.set('x-cron-secret', cronSecret)" )],
  ['bounded sync batches retained', files.cron.includes('Math.min(BATCH_SIZE, 50)')],
  ['retry queue retained', files.cron.includes('nextRetryAt') && files.cron.includes('getRetryState')],
  ['price history retained', files.cron.includes('PriceTrackerHistory.create')],
  ['review threshold retained', files.cron.includes('REVIEW_THRESHOLD')],
];

let failures = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failures++;
}
console.log(`\nPrice Tracker v2.2 audit: ${checks.length - failures}/${checks.length} passed`);
process.exit(failures ? 1 : 0);
