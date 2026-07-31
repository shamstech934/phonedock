import fs from 'node:fs';

const handler = fs.readFileSync('src/app/api/[[...path]]/handlers/ai-research.ts', 'utf8');
const worker = fs.readFileSync('src/lib/ai-research-worker.ts', 'utf8');
const page = fs.readFileSync('src/app/admin/ai-research/page.tsx', 'utf8');
const findings = [];

for (const [label, condition] of [
  ['queued job creation', /status:\s*'queued'/.test(handler)],
  ['bounded run endpoint', /jobs\/:id\/run/.test(handler) && /processAIResearchJob/.test(handler)],
  ['worker cursor batching', /job\.cursor/.test(worker) && /batchSize/.test(worker)],
  ['pending draft dedupe', /findOneAndUpdate\([\s\S]*pending_review/.test(worker)],
  ['client bounded loop', /\/run`/.test(page) && /Processed \$\{current\.processed\}/.test(page)],
]) if (!condition) findings.push(label);

if (findings.length) {
  console.error('AI research queue audit failed:', findings.join(', '));
  process.exit(1);
}
console.log('AI research queue audit passed.');
