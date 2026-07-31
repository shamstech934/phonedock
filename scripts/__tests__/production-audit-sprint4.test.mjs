import assert from 'node:assert/strict';
import fs from 'node:fs';

const importHandler = fs.readFileSync('src/app/api/[[...path]]/handlers/import.ts', 'utf8');
const parser = fs.readFileSync('src/lib/import/v2-parsers.ts', 'utf8');

assert.match(importHandler, /importPhones, rollbackImport/);
assert.match(importHandler, /historyId is required/);
assert.match(importHandler, /action: 'rollback_import'/);
assert.doesNotMatch(importHandler, /Rollback not yet implemented/);
assert.doesNotMatch(importHandler, /status:\s*501/);

assert.match(parser, /result\.errors\.length > result\.data\.length/);
assert.doesNotMatch(parser, /result\.data\.length < result\.data\.length \* 0\.5/);
assert.match(parser, /CSV parsed with/);

console.log('Production Audit Sprint 4 regression checks passed.');
