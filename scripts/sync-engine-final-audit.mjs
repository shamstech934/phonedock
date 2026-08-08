import fs from 'node:fs';

const page = fs.readFileSync('src/app/admin/sync/page.tsx', 'utf8');
const collector = fs.readFileSync('src/app/api/[[...path]]/handlers/collector.ts', 'utf8');
const route = fs.readFileSync('src/app/api/[[...path]]/route.ts', 'utf8');

const checks = [
  ['Sync page uses run-all orchestration endpoint', page.includes("fetch('/api/collector/jobs/run-all'")],
  ['Legacy fake sourceId=all call is removed', !page.includes("sourceId: 'all'") && !page.includes('sourceId: "all"')],
  ['Run-all creates incremental jobs', /mode:\s*'incremental'/.test(collector)],
  ['Run-all skips active queued/running/paused work', /status:\s*\{\s*\$in:\s*\['queued',\s*'running',\s*'paused'\]/.test(collector)],
  ['Run-all writes collector activity log', collector.includes("action: 'collector_run_all'")],
  ['Dashboard exposes pending review count', collector.includes('pendingReview')],
  ['Dashboard exposes recent collector activity', collector.includes('recentActivity')],
  ['Collector handler is wired for POST routing', route.includes('handleCollectorPost(req, segments)')],
  ['Sync UI routes conflicts to collector review', page.includes('href="/admin/collector/review"')],
  ['Sync UI exposes source scheduling workspace', page.includes('href="/admin/collector/sources"') && page.includes('Auto Sync')],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`);
  if (!ok) failed += 1;
}
console.log(`\nSync Engine Final audit: ${checks.length - failed}/${checks.length} PASS`);
if (failed) process.exit(1);
