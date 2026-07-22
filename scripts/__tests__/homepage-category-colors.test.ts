import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync('src/app/HomeContent.tsx', 'utf8');

for (const tone of ['sky', 'rose', 'violet', 'indigo', 'emerald', 'amber', 'orange', 'fuchsia', 'cyan']) {
  assert.match(home, new RegExp(`${tone}:`), `category tone ${tone} must be declared`);
}

const assignments: Array<[string, string]> = [
  ['Latest Phones', 'sky'],
  ['Trending Phones', 'rose'],
  ['Best Camera Phones', 'violet'],
  ['Best Gaming Phones', 'indigo'],
  ['Best Battery Phones', 'emerald'],
  ['Budget Champions', 'amber'],
  ['Premium Flagships', 'orange'],
  ['Upcoming Phones', 'cyan'],
];

for (const [title, tone] of assignments) {
  const line = home.split('\n').find(value => value.includes(title) && value.includes('tone='));
  assert.ok(line?.includes(`tone="${tone}"`), `${title} must use the ${tone} category tone`);
}

assert.match(home, /CATEGORY_TONES\[tone\]/, 'phone sections must resolve colors through the shared category system');
assert.match(home, /rounded-3xl border p-3 shadow-lg sm:p-5/, 'colored categories must preserve shared spacing and responsive padding');

console.log('Homepage category color system tests passed');
