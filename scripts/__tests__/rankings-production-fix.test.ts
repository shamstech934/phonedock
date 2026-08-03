import assert from 'node:assert/strict';
import fs from 'node:fs';

const rankingLogic = fs.readFileSync('src/lib/intelligence/rankings.ts', 'utf8');
const rankingPage = fs.readFileSync('src/app/rankings/page.tsx', 'utf8');
const css = fs.readFileSync('src/app/globals.css', 'utf8');

assert.match(rankingLogic, /CURRENT_YEAR - 4/, 'recent-device eligibility must exist');
assert.match(rankingLogic, /confidence < \(category === 'budget' \? 55 : 45\)/, 'confidence floor must exist');
assert.match(rankingLogic, /availableSignals < 3/, 'overall rankings must require multiple signals');
assert.match(rankingLogic, /pricePKR \|\| 0\) > 150000/, 'budget ceiling must exist');
assert.match(rankingPage, /getTopPhones\(category\.sort, 120\)/, 'ranking candidate pool must be broad enough');
assert.match(rankingPage, /ranking-top-five/, 'top-five grid class must exist');
assert.match(rankingPage, /itemListJsonLd/, 'ranking structured data must exist');
assert.match(css, /repeat\(5, minmax\(0, 1fr\)\).*important/s, 'desktop Top 5 grid must use five columns');
console.log('Rankings production audit passed: 8/8');
