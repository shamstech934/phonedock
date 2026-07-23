import fs from 'node:fs';
const handler = fs.readFileSync('src/app/api/[[...path]]/handlers/data-quality.ts','utf8');
const model = fs.readFileSync('src/lib/models/AIResearchDraft.ts','utf8');
for (const token of ['pending_review','AIResearchDraft.create','ai-drafts','persisted: true']) {
  if (!handler.includes(token) && !model.includes(token)) throw new Error(`Missing ${token}`);
}
console.log('PC7 persistent AI draft checks passed');
