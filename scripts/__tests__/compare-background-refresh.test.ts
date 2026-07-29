import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../../src/app/compare/page.tsx'), 'utf8');

assert.match(source, /const selectedRef = useRef<Phone\[\]>\(\[\]\)/);
assert.match(source, /const \[refreshing, setRefreshing\] = useState\(false\)/);
assert.match(source, /const hasVisibleSelection = selectedRef\.current\.length > 0/);
assert.match(
  source,
  /if \(hasVisibleSelection\) \{\s*setRefreshing\(true\);\s*\} else \{\s*setLoading\(true\);/s,
);
assert.match(source, /selectedRef\.current = phones;\s*setSelected\(phones\)/s);
assert.match(source, /selectedRef\.current = next;\s*setSelected\(next\)/s);
assert.match(source, /selectedRef\.current = \[\];\s*setSelected\(\[\]\)/s);
assert.match(source, /setCompared\(next\.length >= MIN_COMPARE_PHONES\)/);
assert.match(source, /role="status"/);
assert.match(source, /Updating comparison…/);

console.log('compare background refresh regression checks passed');
