import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');
const pipeline = read('src/app/api/[[...path]]/handlers/automation-pipeline.ts');
const route = read('src/app/api/[[...path]]/route.ts');
const settings = read('src/lib/models/Settings.ts');
const layout = read('src/app/admin/layout-control/page.tsx');
const card = read('src/components/shared/PhoneCard.tsx');
const adminLayout = read('src/app/admin/layout.tsx');
const homepageBuilder = read('src/app/admin/homepage-builder/page.tsx');
const vercel = read('vercel.json');

assert.match(pipeline, /reconcileLifecycle/);
assert.match(pipeline, /handleCronUpdatePrices/);
assert.match(pipeline, /syncRumourFeeds/);
assert.match(pipeline, /availabilityStatus: 'discontinued'/);
assert.match(route, /automation-pipeline/);
assert.doesNotMatch(vercel, /\"crons\"\s*:/);
assert.match(route, /segments\[1\] === 'automation-pipeline'/);

assert.match(settings, /catalogLayout/);
assert.match(layout, /desktop: number; tablet: number; mobile: number/);
assert.match(layout, /'Desktop', 'desktop', Monitor, 10/);
assert.match(adminLayout, /Card Layout Control/);
// Verify the navigation capability by stable route and section identifiers, not a UI label.
// Labels may be improved without breaking functionality or CI.
assert.match(adminLayout, /href:\s*['"]\/admin\/homepage-builder['"]/);
assert.match(homepageBuilder, /['"]navigation['"],\s*Navigation,\s*['"]Header & links['"]/);
assert.match(adminLayout, /Automation Pipeline/);

assert.match(card, /Coming Soon/);
assert.match(card, /Rumoured/);
assert.match(card, /Discontinued/);
assert.match(card, /discountPercent/);

console.log('automation and layout control regression checks passed');
