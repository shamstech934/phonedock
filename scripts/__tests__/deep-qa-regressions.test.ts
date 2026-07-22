import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serializeJsonLd } from '../../src/lib/json-ld';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const encoded = serializeJsonLd({ title: '</script><script>alert(1)</script>', amp: '&' });
assert.doesNotMatch(encoded, /<\/script>/i);
assert.match(encoded, /\\u003c\/script\\u003e/);
assert.match(encoded, /\\u0026/);

for (const page of [
  'src/app/layout.tsx',
  'src/app/reviews/[slug]/page.tsx',
  'src/app/buying-guides/[slug]/page.tsx',
  'src/app/phones/[slug]/page.tsx',
  'src/app/news/[slug]/page.tsx',
]) {
  const source = read(page);
  assert.match(source, /serializeJsonLd/);
  assert.doesNotMatch(source, /__html: JSON\.stringify/);
}

const search = read('src/app/search/page.tsx');
assert.doesNotMatch(search, /window\.location\.reload/);
assert.match(search, /setRetryNonce/);

const tracker = read('src/app/admin/price-tracker/page.tsx');
assert.doesNotMatch(tracker, /catch \{\}/);
assert.match(tracker, /role="alert"/);
assert.doesNotMatch(tracker, /\? null : null/);

for (const page of ['src/app/admin/phones/new/page.tsx', 'src/app/admin/phones/[id]/edit/page.tsx']) {
  assert.doesNotMatch(read(page), /catch \{\}/);
  assert.match(read(page), /role="alert"/);
}

for (const [model, field] of [
  ['src/lib/models/User.ts', 'email'],
  ['src/lib/models/ImportJob.ts', 'importId'],
  ['src/lib/models/SystemState.ts', 'key'],
  ['src/lib/models/Video.ts', 'youtubeId'],
  ['src/lib/models/UserFeatures.ts', 'shareId'],
] as const) {
  const line = read(model).split('\n').find(value => value.includes(`${field}:`) && value.includes('unique: true')) || '';
  assert.match(line, /unique: true/);
  assert.doesNotMatch(line, /index: true/);
}

const api = read('src/app/api/[[...path]]/route.ts');
assert.match(api, /\.limit\(500\)[\s\S]*\.populate\('phoneId'\)/);
assert.match(api, /hasMore: alerts\.length === 500/);

const turnstile = read('src/components/shared/TurnstileWidget.tsx');
assert.match(turnstile, /onVerifyRef\.current\(token\)/);
assert.match(turnstile, /onErrorRef\.current\?\.\(\)/);

console.log('Deep QA regression checks passed');
