import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const card = readFileSync('src/components/shared/PhoneCard.tsx', 'utf8');
const brandPage = readFileSync('src/app/brands/[slug]/BrandDetailClient.tsx', 'utf8');
const serializer = readFileSync('src/app/api/[[...path]]/handlers/helpers.ts', 'utf8');
const rankings = readFileSync('src/lib/get-top-phones.ts', 'utf8');
const priceTrackerAdmin = readFileSync('src/app/admin/price-tracker/page.tsx', 'utf8');
const priceTrackerApi = readFileSync('src/app/api/[[...path]]/handlers/price-tracker.ts', 'utf8');
const phonesPage = readFileSync('src/app/phones/PhonesClient.tsx', 'utf8');
const publicListings = readFileSync('src/lib/fetch-public-listings.ts', 'utf8');

for (const field of ['currentPrice', 'previousPrice', 'priceChange', 'percentageChange', 'lastPriceCheckedAt', 'lastVerifiedAt']) {
  assert.match(serializer, new RegExp(`${field}: r\\.${field}`), `public serializer must expose ${field}`);
}

assert.match(card, /const compareAtPrice = Math\.max/, 'card must combine manual and automatically tracked comparison prices');
assert.match(card, /previousPrice > currentPrice/, 'an automatic price drop must create a crossed-out comparison price');
assert.match(card, /Price drop/, 'card must show price-drop state');
assert.match(card, /Price up/, 'card must show price-increase state');
assert.match(card, /PTA Approved/);
assert.match(card, /Non-PTA/);
assert.match(card, /Coming Soon/);
assert.match(card, /Rumoured/);
assert.match(card, /Discontinued/);

assert.match(brandPage, /type LifecycleTab = 'all' \| 'latest' \| 'rumored' \| 'coming_soon' \| 'discontinued'/);
assert.match(brandPage, /\['latest', 'Available \/ Latest'\]/);
assert.match(brandPage, /\['rumored', 'Rumoured'\]/);
assert.match(brandPage, /\['coming_soon', 'Coming Soon'\]/);
assert.match(brandPage, /value === 'upcoming' \? 'coming_soon'/, 'old shared upcoming URLs must remain compatible');
assert.match(rankings, /previousPrice:/, 'ranking cards must receive automatic price history too');
assert.match(rankings, /availabilityStatus:/, 'ranking cards must receive lifecycle state too');
assert.match(priceTrackerAdmin, /function formatPercentChange\(percentChange: unknown\)/, 'legacy price records need a null-safe percentage formatter');
assert.doesNotMatch(priceTrackerAdmin, /\.percentChange\.toFixed\(/, 'missing percentage data must never crash the Price Tracker page');
assert.match(priceTrackerApi, /filter\.changeType = \{ \$in: \['increase', 'decrease'\] \}/, 'baseline price detections must not appear as market changes');
assert.match(priceTrackerApi, /p\.priceMode === 'automatic' && listing\?\.verificationStatus === 'verified'/, 'admin tracker mode must require a verified listing');
assert.match(priceTrackerApi, /priceMode: nextMode/, 'individual tracking toggle must persist priceMode');
assert.match(priceTrackerApi, /Auto-tracking needs a verified product page from an enabled trusted source/, 'unverified phones need an actionable automation error');
assert.match(priceTrackerApi, /phones\/enable-eligible/, 'bulk linked-phone automation endpoint must exist');
assert.match(priceTrackerApi, /manualLock: \{ \$ne: true \}/, 'bulk automation must preserve explicit manual locks');
assert.match(priceTrackerApi, /modeTotals: \{ manual: manualTotal, automatic: automaticTotal \}/, 'phone mode totals must cover the full published catalog');
assert.match(priceTrackerApi, /alreadyEnabled/, 'bulk automation must distinguish already-enabled phones');
assert.match(priceTrackerAdmin, /Enable verified phones/, 'admin must expose the verified bulk automatic tracking action');
assert.match(priceTrackerAdmin, /setActionLoading\(''\);[\s\S]*Promise\.allSettled/, 'slow refresh queries must not leave bulk automation stuck loading');
assert.match(priceTrackerAdmin, /const \[actionError, setActionError\]/, 'action errors must not replace the whole phone catalog');
assert.match(priceTrackerAdmin, /Link required/, 'unverified listings must explain why automatic tracking is unavailable');
assert.match(priceTrackerAdmin, /includeUnlinked: '1'/, 'Source Gaps must request the real unlinked catalog');
assert.match(priceTrackerAdmin, /Unlinked catalog phones/, 'Source Gaps must identify unlinked phones separately from URL match failures');
assert.match(priceTrackerAdmin, /sourceGapsTotalPages/, 'large unlinked catalogs must be paginated');
assert.match(priceTrackerApi, /_id: \{ \$nin: linkedPhoneIds\.filter\(Boolean\) \}/, 'unlinked catalog query must exclude every linked phone');
assert.match(priceTrackerApi, /Phone\.countDocuments\(unlinkedFilter\)/, 'Source Gaps must return the same real unlinked count represented in Overview');
for (const alias of ['percentChange:', 'source:', 'status:', 'date:']) {
  assert.match(priceTrackerApi, new RegExp(alias), `admin Price Tracker response must expose the ${alias} UI alias`);
}

for (const label of ['All Phones', 'Latest', 'Price Drops', 'Rumoured', 'Coming Soon', 'Discontinued']) {
  assert.match(phonesPage, new RegExp(`label: '${label}'`), `main phones page must expose the ${label} market tab`);
}
assert.match(phonesPage, /params\.set\('priceDrop', 'true'\)/, 'Price Drops tab must activate automatic discount filtering');
assert.match(phonesPage, /params\.set\('availability', 'upcoming'\)/, 'Coming Soon tab must include the combined upcoming lifecycle');
assert.match(publicListings, /\['announced', 'coming_soon'\]/, 'upcoming listing must include announced and coming-soon phones');

console.log('phone card market status and lifecycle tabs: all assertions passed');
