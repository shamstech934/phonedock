import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const page = fs.readFileSync(path.join(process.cwd(), 'src/app/compare/page.tsx'), 'utf8');

assert.match(page, /\}, \[slugsParam\]\);/, 'comparison must rehydrate whenever selected URL slugs change');
assert.doesNotMatch(page, /\}, \[\]\); \/\/ eslint-disable-line react-hooks\/exhaustive-deps/, 'comparison lookup must not be mount-only');
assert.match(page, /results are intentionally lightweight/, 'comparison must document why full hydration is required');
assert.match(page, /Number\.isFinite\(score\)/, 'score rendering must reject NaN and invalid numeric data');
assert.match(page, /s\.score > 0 \? Math\.round\(s\.score\) : '—'/, 'missing scores must render safely');
assert.match(page, /const populatedRows = rows\.filter/, 'fully empty specification rows must not fill the comparison table');
assert.doesNotMatch(page, /setTimeout\(\(\) => \{ setCompared\(true\)/, 'autocomplete records must not be compared before hydration');

console.log('compare-full-hydration: all assertions passed');
