import fs from 'node:fs';

const handler = fs.readFileSync('src/app/api/[[...path]]/handlers/price-tracker.ts', 'utf8');
const cron = fs.readFileSync('src/app/api/[[...path]]/handlers/cron-update-prices.ts', 'utf8');
const ui = fs.readFileSync('src/app/admin/price-tracker/page.tsx', 'utf8');

const checks = [
  ['overview counts price + listing reviews', handler.includes('pendingReview: pendingPriceChanges + pendingListingReviews')],
  ['pending endpoint loads history reviews', handler.includes("PriceTrackerHistory.find({ verificationStatus: 'pending' })")],
  ['pending endpoint loads listing reviews', handler.includes("PhoneRetailListing.find({ enabled: true, verificationStatus: 'pending' })")],
  ['review queue discriminates listing items', handler.includes("reviewType: 'listing-verification' as const")],
  ['review queue exposes listing reason', handler.includes("reason: listing.lastError")],
  ['backend blocks unknown PK PTA verification', handler.includes('Pakistan listings require an explicit PTA Approved or Non-PTA classification before verification.')],
  ['sync separates pending price changes', cron.includes('pendingPriceChanges: 0') && cron.includes('summary.pendingPriceChanges++')],
  ['sync separates pending listing verification', cron.includes('pendingListings: 0') && cron.includes('summary.pendingListings++')],
  ['UI renders combined review queue', ui.includes('listing verifications') && ui.includes('Listing verification')],
  ['UI has direct listing review action', ui.includes('Review listing') && ui.includes('openListingReview(item)')],
  ['UI supports safe reject and disable', ui.includes("{ verificationStatus: 'rejected', enabled: false }")],
  ['UI supports explicit save and verify', ui.includes('Save & verify') && ui.includes("verificationStatus: 'verified'" )],
  ['sync message distinguishes review types', ui.includes('price change${') && ui.includes('awaiting verification')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`PASS ${checks.length}/${checks.length} price review queue consolidation checks`);
