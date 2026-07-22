import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const page = read('src/app/admin/collector/sources/page.tsx');
const handler = read('src/app/api/[[...path]]/handlers/collector.ts');
const model = read('src/lib/models/CollectorSource.ts');

// Native form flow: submit is controlled and cannot navigate/reload the document.
assert.match(page, /<form onSubmit=\{handleAdd\}/);
assert.match(page, /event\.preventDefault\(\)/);
assert.match(page, /type="submit"/);
assert.doesNotMatch(page, /window\.location\.reload/);

// Client request and response behavior.
assert.match(page, /fetch\('\/api\/collector\/sources'/);
assert.match(page, /method: 'POST'/);
assert.match(page, /credentials: 'include'/);
assert.match(page, /enabled: true/);
assert.match(page, /setSources\(current => \[result\.source!/);
assert.match(page, /role="alert"/);
assert.match(page, /Adding…/);
assert.match(page, /if \(saving\) return/);
assert.match(page, /response\.status === 401/);

// UI options submit exact schema enum values rather than labels.
for (const type of ['api', 'json_url', 'csv_url', 'xml_feed', 'rss_feed', 'manual_url', 'file_upload', 'manufacturer']) {
  assert.match(page, new RegExp(`option value="${type}"`));
  assert.match(model, new RegExp(`'${type}'`));
}

// Backend validation, authorization, persistence and status contracts.
assert.match(handler, /getAdminFromRequest\(req\)/);
assert.match(handler, /requirePermission\(admin, 'collectors:manage'\)/);
assert.match(handler, /Name is required/);
assert.match(handler, /Invalid source type/);
assert.match(handler, /validateUrlForFetch/);
assert.match(handler, /Source already exists/);
assert.match(handler, /code === 11000/);
assert.match(handler, /CollectorSource\.create/);
assert.match(handler, /status: 201/);
assert.match(handler, /status: 400/);
assert.match(handler, /status: 409/);

// GET reads MongoDB records rather than returning a fixed list.
assert.match(handler, /CollectorSource\.find\(\)\.sort/);

console.log('Collector source creation regression checks passed');
