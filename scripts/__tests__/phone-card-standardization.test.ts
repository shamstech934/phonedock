import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const card = fs.readFileSync(path.join(root, 'src/components/shared/PhoneCard.tsx'), 'utf8');
const phones = fs.readFileSync(path.join(root, 'src/app/phones/PhonesClient.tsx'), 'utf8');
const search = fs.readFileSync(path.join(root, 'src/app/search/page.tsx'), 'utf8');
const home = fs.readFileSync(path.join(root, 'src/app/HomeContent.tsx'), 'utf8');
const rankings = fs.readFileSync(path.join(root, 'src/app/rankings/page.tsx'), 'utf8');

assert.equal((card.match(/phone\.overallRating\.toFixed\(1\)/g) || []).length, 1, 'rating must render once');
assert.match(card, /absolute right-2 top-2/, 'rating must remain in the fixed top-right position');
assert.match(card, /fill-amber-400 text-amber-400/, 'rating must use the canonical gold-star style');
assert.match(card, /line-clamp-2 h-10 min-h-10/, 'long titles need a fixed two-line area');
assert.match(card, /mt-auto flex h-11/, 'actions need a fixed bottom-aligned area');
assert.doesNotMatch(phones, /function PhoneCardSkeleton/);
assert.doesNotMatch(search, /function PhoneCardSkeleton/);
assert.match(home, /reviewedPhones\.map\(p => <PhoneCard/);
assert.match(rankings, /<PhoneCard phone=\{item\.phone\}/);

console.log('Phone card standardization tests passed');
