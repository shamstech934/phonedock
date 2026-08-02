import fs from 'node:fs';

const manual = fs.readFileSync('src/lib/collectors/providers/manual-url-provider.ts', 'utf8');
const runner = fs.readFileSync('src/lib/collectors/job-runner.ts', 'utf8');
const api = fs.readFileSync('src/app/api/[[...path]]/handlers/collector.ts', 'utf8');
const ui = fs.readFileSync('src/app/admin/collector/jobs/page.tsx', 'utf8');

const checks = {
  pageAwareProvider: /async fetch\(page: number = 1\)/.test(manual),
  boundedPageSize: /Math\.min\(8/.test(manual),
  boundedConcurrency: /COLLECTOR_PRODUCT_CONCURRENCY/.test(manual),
  providerDeadline: /COLLECTOR_PROVIDER_BUDGET_MS/.test(manual),
  singlePageInvocation: /COLLECTOR_PAGES_PER_INVOCATION \|\| '1'/.test(runner),
  heartbeat: /lastProcessedAt: new Date\(\), currentBatch/.test(runner),
  staleRecovery: /exceeded the serverless execution window/.test(api),
  activePolling: /setInterval\(\(\) => fetchJobs\(\), 5000\)/.test(ui),
};
const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) { console.error('Collector runtime audit failed:', failed.join(', ')); process.exit(1); }
console.log('Collector runtime stability audit passed:', checks);
