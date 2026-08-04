import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const api = fs.readFileSync(
  path.join(process.cwd(), 'src/app/api/[[...path]]/handlers/public.ts'),
  'utf8',
);
const start = api.indexOf("// ---- /api/phones/autocomplete?q=... ----");
const end = api.indexOf("// ---- /api/phones/:slug ----", start);
const autocomplete = api.slice(start, end);

assert.ok(start >= 0 && end > start, 'autocomplete route must exist');
assert.ok(
  autocomplete.indexOf('await connectDB()') < autocomplete.indexOf('checkIpRateLimit'),
  'MongoDB must connect before the database-backed rate limiter runs',
);
assert.match(
  autocomplete,
  /maxTimeMS\s*(?:\(\s*5000\s*\)|:\s*5000)/,
  'autocomplete query must have a realistic bounded time budget',
);
assert.match(autocomplete, /const brandIds = await Brand\.find/, 'autocomplete must fall back to direct brand matching');
assert.match(autocomplete, /\.limit\(12\)/, 'fallback results must remain bounded');
assert.match(autocomplete, /modelName: \{ \$regex: safe/, 'fallback must search phone model names');

console.log('compare-autocomplete-reliability: all assertions passed');
