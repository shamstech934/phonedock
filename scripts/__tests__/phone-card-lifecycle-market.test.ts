import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const card = readFileSync('src/components/shared/PhoneCard.tsx', 'utf8');
const brandPage = readFileSync('src/app/brands/[slug]/BrandDetailClient.tsx', 'utf8');
const serializer = readFileSync('src/app/api/[[...path]]/handlers/helpers.ts', 'utf8');
const rankings = readFileSync('src/lib/get-top-phones.ts', 'utf8');

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

console.log('phone card market status and lifecycle tabs: all assertions passed');
