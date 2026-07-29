import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const serverPage = fs.readFileSync(path.join(root, 'src/app/brands/[slug]/page.tsx'), 'utf8');
const page = fs.readFileSync(path.join(root, 'src/app/brands/[slug]/BrandDetailClient.tsx'), 'utf8');
const listings = fs.readFileSync(path.join(root, 'src/lib/fetch-public-listings.ts'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/app/api/[[...path]]/handlers/public.ts'), 'utf8');

assert.match(page, /type LifecycleTab = 'all' \| 'latest' \| 'upcoming' \| 'discontinued'/, 'brand page must expose lifecycle tabs');
assert.match(page, /role="tablist"/, 'lifecycle navigation must be accessible');
assert.match(page, /Coming Soon/, 'brand page must expose upcoming phones');
assert.match(page, /Discontinued/, 'brand page must expose discontinued phones');
assert.match(page, /aria-label="Release year"/, 'brand page must support release-year filtering');
assert.match(page, /Price range/, 'brand page must summarize its available price range');
assert.match(page, /OFFICIAL_LOGOS/, 'brand header must use the resilient official logo map');
assert.match(page, /setLifecycleTab\('all'\)/, 'clear filters must reset lifecycle state');
assert.match(page, /aria-label="Phone series"/, 'brand page must support series filtering');
assert.match(page, /xl:grid-cols-5/, 'brand cards must use a more compact five-column desktop grid');
assert.match(page, /Phone Price List/, 'brand page must expose a compact price and specification table');
assert.match(page, /Price not available/, 'brand price table must handle missing prices honestly');
assert.match(page, /new URLSearchParams\(window\.location\.search\)/, 'brand filters must restore state from a shared URL');
assert.match(page, /window\.history\.replaceState/, 'brand filters must keep the browser URL synchronized');
assert.match(page, /query\.set\('series', seriesFilter\)/, 'series selection must be shareable');
assert.match(serverPage, /fetchPublicBrandDetail\(slug\)/, 'brand page must load initial catalogue data on the server');
assert.doesNotMatch(page, /fetch\(`\/api\/brands\//, 'brand page must not wait for a duplicate client-side catalogue request');
assert.match(listings, /public-brand-detail-v1/, 'server brand catalogue data must use a bounded cache');
assert.match(api, /max: 250/, 'brand endpoint must safely support the expanded brand catalogue');

console.log('brand-page-pro: all assertions passed');
