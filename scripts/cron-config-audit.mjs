import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const vercelPath = path.join(root, 'vercel.json');
const routePath = path.join(root, 'src/app/api/[[...path]]/route.ts');

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
};

if (!fs.existsSync(vercelPath)) {
  fail('vercel.json is missing.');
  process.exit();
}
if (!fs.existsSync(routePath)) {
  fail('Unified API route is missing.');
  process.exit();
}

const config = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
const routeSource = fs.readFileSync(routePath, 'utf8');
const crons = Array.isArray(config.crons) ? config.crons : [];

if (crons.length === 0) fail('No Vercel cron jobs are configured.');

const seen = new Set();
for (const cron of crons) {
  if (!cron?.path || !cron?.schedule) {
    fail('Each cron entry must contain path and schedule.');
    continue;
  }
  if (seen.has(cron.path)) fail(`Duplicate cron path: ${cron.path}`);
  seen.add(cron.path);

  if (!cron.path.startsWith('/api/cron/')) fail(`Cron path must be under /api/cron/: ${cron.path}`);
  const slug = cron.path.split('/').filter(Boolean).at(-1);
  if (!slug || !routeSource.includes(`segments[1] === '${slug}'`)) {
    fail(`Cron route is configured but not implemented in unified API routing: ${cron.path}`);
  }

  // Basic five-field cron validation. Vercel uses UTC schedules.
  const fields = String(cron.schedule).trim().split(/\s+/);
  if (fields.length !== 5) fail(`Invalid cron schedule (${cron.schedule}) for ${cron.path}`);
}

if (!routeSource.includes('isValidCronSecret')) {
  fail('Cron routes do not appear to use centralized CRON_SECRET validation.');
}

if (!process.exitCode) {
  console.log(`✓ Cron configuration audit passed (${crons.length} jobs).`);
  for (const cron of crons) console.log(`  ${cron.schedule} UTC  ${cron.path}`);
}
