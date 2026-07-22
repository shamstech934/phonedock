import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { decodeCursor, encodeCursor, cursorFilter, CURSOR_SORT } from '../../src/lib/cursor-pagination';
import { redactLogValue } from '../../src/lib/observability/logger';
import { captureException } from '../../src/lib/observability/error-tracking';

const root = path.resolve(import.meta.dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const id = '507f1f77bcf86cd799439011';
const encoded = encodeCursor({ createdAt: '2026-07-22T00:00:00.000Z', id });
const decoded = decodeCursor(encoded);
assert.equal(decoded?.id.toString(), id);
assert.equal(decoded?.createdAt.toISOString(), '2026-07-22T00:00:00.000Z');
assert.equal(decodeCursor('invalid'), null);
assert.deepEqual(CURSOR_SORT, { createdAt: -1, _id: -1 });
assert.ok('$or' in cursorFilter(decoded));

const redacted = redactLogValue({ password: 'pw', nested: { jwtToken: 'jwt', safe: 'ok' }, cookie: 'session' }) as Record<string, unknown>;
assert.equal(redacted.password, '[REDACTED]');
assert.deepEqual(redacted.nested, { jwtToken: '[REDACTED]', safe: 'ok' });
assert.equal(redacted.cookie, '[REDACTED]');
assert.doesNotThrow(() => captureException(new Error('provider-free fallback')));

for (const page of ['phones/page.tsx', 'brands/page.tsx', 'rankings/page.tsx', 'reviews/page.tsx']) {
  const source = read(`src/app/${page}`);
  assert.doesNotMatch(source, /force-dynamic/);
  assert.match(source, /export const revalidate = \d+/);
}
assert.match(read('src/lib/fetch-public-listings.ts'), /unstable_cache[\s\S]*tags: \['phones'\]/);
assert.match(read('src/lib/revalidate.ts'), /revalidateTag\('phones'/);
assert.match(read('src/components/observability/WebVitalsReporter.tsx'), /LCP[\s\S]*INP[\s\S]*CLS[\s\S]*FCP[\s\S]*TTFB/);
assert.match(read('e2e/accessibility.spec.ts'), /AxeBuilder/);

console.log('Phase 1 performance/reliability tests passed');
