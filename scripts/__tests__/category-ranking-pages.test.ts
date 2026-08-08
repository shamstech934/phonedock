import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const shared = read('src/components/shared/TopPhonesClientPage.tsx');
const publicApi = read('src/app/api/[[...path]]/handlers/public.ts');
const serverRankings = read('src/lib/get-top-phones.ts');
assert.match(shared, /rankPhones\(phones, rankingCategory, phones\.length\)/);
assert.match(shared, /categoryScore=\{rankingCategory\s*\?\s*item\.score/s);
assert.match(shared, /hideOverallRating=\{Boolean\(rankingCategory \|\| badgeField\)\}/);
assert.match(shared, /\{rankingCategory && \(\s*<span[\s\S]*#\{item\.rank\}/);
for (const source of [publicApi, serverRankings]) {
  assert.match(source, /upcoming: \{ \$ne: true \}/);
  assert.match(source, /availabilityStatus: \{ \$nin: \['discontinued', 'cancelled'\] \}/);
}

const expectations = [
  ['best-gaming-phone', 'performanceScore', 'gaming', 'Gaming'],
  ['best-camera-phone', 'cameraScore', 'camera', 'Camera'],
  ['best-battery-phone', 'batteryScore', 'battery', 'Battery'],
  ['best-value-phone', 'valueScore', 'value', 'Value'],
  ['best-budget-phone', 'valueScore', 'budget', 'Budget'],
] as const;

for (const [route, sort, category, label] of expectations) {
  const page = read(`src/app/${route}/page.tsx`);
  assert.match(page, new RegExp(`sort="${sort}"`), `${route} must fetch the correct score pool`);
  assert.match(page, new RegExp(`rankingCategory="${category}"`), `${route} must use category ranking`);
  assert.match(page, new RegExp(`badgeLabel="${label}"`), `${route} must show its category score`);
  assert.doesNotMatch(page, /Pakistan 2025/, `${route} metadata must not be stale`);
}

console.log('category ranking page regression checks passed');
