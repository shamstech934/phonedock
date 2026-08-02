import fs from 'node:fs';

const checks = [
  ['provider result warnings', 'src/lib/collectors/providers/base.ts', /providerWarnings\?: string\[\]/],
  ['provider result skipped count', 'src/lib/collectors/providers/base.ts', /skippedCount\?: number/],
  ['asset skip filter', 'src/lib/collectors/providers/manual-url-provider.ts', /Skipped non-product asset/],
  ['RSS non-fabrication rule', 'src/lib/collectors/providers/xml-provider.ts', /RSS\/Atom feeds are article streams/],
  ['RSS php3 detection', 'src/lib/collectors/source-detection.ts', /rss-news-reviews\\\.php3/],
  ['job warning schema', 'src/lib/models/CollectorJob.ts', /warningLog/],
  ['job skipped schema', 'src/lib/models/CollectorJob.ts', /skippedCount/],
  ['runner warning persistence', 'src/lib/collectors/job-runner.ts', /warningLog: \(result\.providerWarnings/],
  ['UI warning rendering', 'src/app/admin/collector/jobs/page.tsx', /job\.warningLog\.map/],
  ['UI skipped asset badge', 'src/app/admin/collector/jobs/page.tsx', /skipped assets/],
];
let failed = 0;
for (const [label, file, pattern] of checks) {
  const source = fs.readFileSync(file, 'utf8');
  const pass = pattern.test(source);
  console.log(`${pass ? '✓' : '✗'} ${label}`);
  if (!pass) failed += 1;
}
if (failed) process.exit(1);
console.log(`Collector hardening audit: ${checks.length}/${checks.length} passed`);
