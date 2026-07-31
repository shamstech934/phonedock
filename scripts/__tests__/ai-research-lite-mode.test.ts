import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

const policy = read('src/lib/ai-research-policy.ts');
const worker = read('src/lib/ai-research-worker.ts');
const handler = read('src/app/api/[[...path]]/handlers/ai-research.ts');
const page = read('src/app/admin/ai-research/page.tsx');
const model = read('src/lib/models/AIResearchJob.ts');

assert(policy.includes("AI_RESEARCH_MODE || 'lite'"), 'Lite mode must be the default');
assert(policy.includes('maxPhonesPerJob'), 'Policy must cap phones per job');
assert(policy.includes('maxProviderCallsPerJob'), 'Policy must cap provider calls');
assert(policy.includes('cooldownSeconds'), 'Policy must include cooldown');
assert(worker.includes('lockUntil'), 'Worker must use a job lock');
assert(worker.includes('freshSince'), 'Worker must reuse fresh pending drafts');
assert(worker.includes('providerCalls'), 'Worker must track provider calls');
assert(worker.includes('skippedThisRun'), 'Worker must track skipped phones');
assert(handler.includes('getAIResearchPolicy'), 'API must expose and enforce policy');
assert(handler.includes('policy.maxPhonesPerJob'), 'API must enforce max phones');
assert(model.includes("mode: { type: String, enum: ['lite', 'standard']"), 'Job must record mode');
assert(page.includes('Load protection:'), 'Admin must show load-protection limits');
assert(page.includes('Lite-mode cooldown'), 'Admin must handle cooldown without hammering API');

console.log('AI Research Lite Mode regression checks passed.');
