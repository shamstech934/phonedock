import fs from 'node:fs';
import assert from 'node:assert/strict';

const handler = fs.readFileSync('src/app/api/[[...path]]/handlers/data-quality.ts', 'utf8');
const scanner = fs.readFileSync('src/lib/data-quality/scanner.ts', 'utf8');
const page = fs.readFileSync('src/app/admin/data-quality/page.tsx', 'utf8');

assert.match(handler, /status: \{ \$in: \['published', 'draft', 'pending'\] \}/, 'summary must include working draft catalog');
assert.match(handler, /const missingSpecs = catalogPhoneRows\.filter/, 'missing specs must be computed live');
assert.match(handler, /return !thumbnail \|\| !imagePhoneIdSet/, 'missing images must detect either missing thumbnail or gallery');
assert.match(handler, /Phone\.countDocuments\(\{ \.\.\.catalogScope, \$or:/, 'stale prices must be live, not issue-table only');
assert.match(scanner, /const base = totalPhones \|\| 1/, 'health score and cards must share the same catalog scope');
assert.match(page, /Published \+ Draft\/Review/, 'UI must explain the live counter scope');
console.log('Data Quality live-count regression audit: 6/6 passed');
