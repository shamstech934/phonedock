import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { formatCardScore } from '../../src/components/shared/phone-card-utils';

const root = path.resolve(import.meta.dirname, '../..');
const card = fs.readFileSync(path.join(root, 'src/components/shared/PhoneCard.tsx'), 'utf8');
const rankings = fs.readFileSync(path.join(root, 'src/components/shared/TopPhonesClientPage.tsx'), 'utf8');

assert.equal(formatCardScore(9), '9');
assert.equal(formatCardScore(9.2), '9.2');
assert.equal(formatCardScore(9.0), '9');
assert.equal(formatCardScore(undefined), null);
assert.equal(formatCardScore(Number.NaN), null);
assert.equal(formatCardScore(Infinity), null);
assert.match(card, /data-testid="category-score"[\s\S]*absolute right-2 top-2/);
assert.match(card, /data-testid="overall-rating"[\s\S]*absolute bottom-2 right-2/);
assert.match(card, /data-testid="phone-card-link"/);
assert.match(card, /aria-label=\{`View \$\{phone\.brand/);
assert.match(rankings, /hideOverallRating=\{badgeField === 'overallRating'\}/);
assert.doesNotMatch(rankings, /absolute top-3 right-3/);

console.log('Ranking card interaction tests passed');
