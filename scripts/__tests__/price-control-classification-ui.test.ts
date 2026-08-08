import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const page = fs.readFileSync(path.join(root, 'src/app/admin/price-tracker/page.tsx'), 'utf8');
const handler = fs.readFileSync(path.join(root, 'src/app/api/[[...path]]/handlers/price-tracker.ts'), 'utf8');

assert.match(page, /All published phones/, 'global published count must not be mislabeled as filtered total');
assert.match(page, /Matching current filter/, 'active bucket must show its own matching count');
assert.match(page, /Unclassified \/ Needs Review/, 'price control must expose an unclassified review bucket');
assert.match(page, /Review \{phoneCatalogStats\.unclassified\} unclassified prices/, 'empty classified buckets must route to unclassified review');
assert.match(handler, /catalogStats:\s*\{/, 'phones API must return classification-aware catalog stats');
assert.match(handler, /unclassified:\s*unclassifiedPhoneIds\.length/, 'phones API must count unclassified priced phones');
assert.match(handler, /priceType === 'unclassified'/, 'phones API must support unclassified filtering');
assert.match(handler, /currentPrice:\s*\{ \$gt: 0 \}/, 'legacy priced phones without typed PhonePrice rows must be reviewable');

console.log('Price Control classification/count regression checks passed');
