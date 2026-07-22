import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const card = fs.readFileSync(path.join(root, 'src/components/shared/PhoneCard.tsx'), 'utf8');
const phones = fs.readFileSync(path.join(root, 'src/app/phones/PhonesClient.tsx'), 'utf8');
const search = fs.readFileSync(path.join(root, 'src/app/search/page.tsx'), 'utf8');
const home = fs.readFileSync(path.join(root, 'src/app/HomeContent.tsx'), 'utf8');
const rankings = fs.readFileSync(path.join(root, 'src/app/rankings/page.tsx'), 'utf8');

assert.equal((card.match(/data-testid="overall-rating"/g) || []).length, 1, 'rating must render once');
assert.match(card, /overall-rating[\s\S]*absolute bottom-2 right-2/, 'overall rating must remain in the fixed bottom-right position');
assert.match(card, /fill-amber-400 text-amber-400/, 'rating must use the canonical gold-star style');
assert.match(card, /line-clamp-2 h-10 min-h-10/, 'long titles need a fixed two-line area');
assert.match(card, /phone-card-specs[\s\S]*h-16 min-h-16 max-h-16/, 'zero to five specs must share a fixed reserved area');
assert.match(card, /grid-cols-2 grid-rows-3/, 'specs must use a bounded three-row layout');
assert.equal((card.match(/phone\.specs\?\./g) || []).length >= 4, true, 'missing specs must remain conditional rather than fabricated');
assert.match(card, /phone-card-actions[\s\S]*mt-auto flex h-11 min-h-11/, 'actions need a fixed bottom-aligned area');
assert.match(card, /phone-card-actions[\s\S]*min-w-0/, 'action row must be allowed to shrink inside narrow cards');
assert.match(card, /<span className="truncate">View<\/span>/, 'the primary action must use a width-safe label');
assert.match(card, /hidden h-11 w-9[\s\S]*data-testid="quick-view-action"|data-testid="quick-view-action"[\s\S]*hidden h-11 w-9/, 'quick view must use the compact action width');
assert.match(card, /h-\[440px\][\s\S]*sm:h-\[472px\]/, 'card variants need deterministic responsive heights');
assert.doesNotMatch(phones, /function PhoneCardSkeleton/);
assert.doesNotMatch(search, /function PhoneCardSkeleton/);
assert.match(home, /reviewedPhones\.map\(p => <PhoneCard/);
assert.match(rankings, /<PhoneCard phone=\{item\.phone\}/);

console.log('Phone card standardization tests passed');
