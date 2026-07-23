import fs from 'node:fs';
import assert from 'node:assert/strict';

const handler = fs.readFileSync('src/app/api/[[...path]]/handlers/data-quality.ts', 'utf8');
const page = fs.readFileSync('src/app/admin/data-quality/page.tsx', 'utf8');
const model = fs.readFileSync('src/lib/models/AIResearchJob.ts', 'utf8');
assert.match(handler, /ai-drafts' && segments\[3\] === 'action'/);
assert.match(handler, /Approve|Specifications published|Primary image published|Price published/);
assert.match(handler, /ai-jobs/);
assert.match(handler, /generateEnrichmentSuggestions/);
assert.match(page, /AI Research Control Center/);
assert.match(page, /Approve & publish/);
assert.match(page, /Auto run 20 batches/);
assert.match(model, /completed_with_errors/);
console.log('v9 PC8 complete AI review static checks passed');
