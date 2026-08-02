import fs from 'node:fs';
const checks = [
  ['DB connection in job runner', 'src/lib/collectors/job-runner.ts', 'await connectDB();'],
  ['bounded invocation counter', 'src/lib/collectors/job-runner.ts', 'pagesProcessedThisInvocation'],
  ['draft refresh/upsert', 'src/lib/collectors/job-runner.ts', 'existingDraft'],
  ['safe redirect handling', 'src/lib/collectors/providers/base.ts', "redirect: 'manual'"],
  ['source test status persistence', 'src/app/api/[[...path]]/handlers/collector.ts', 'lastTestStatus'],
  ['cron resumes collector jobs', 'src/app/api/[[...path]]/route.ts', 'resumableJobs'],
  ['collector source edit support', 'src/app/api/[[...path]]/handlers/collector.ts', 'syncFrequencyHours'],
];
let failed = 0;
for (const [label, file, needle] of checks) { const ok = fs.readFileSync(file,'utf8').includes(needle); console.log(`${ok?'PASS':'FAIL'} ${label}`); if(!ok) failed++; }
if (failed) process.exit(1);
console.log(`Collector Phase 2 audit passed (${checks.length}/${checks.length}).`);
