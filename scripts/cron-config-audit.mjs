import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const routeSource = fs.readFileSync('src/app/api/[[...path]]/route.ts', 'utf8');
const crons = Array.isArray(config.crons) ? config.crons : [];

if (crons.length !== 0) {
  console.error('✗ Free-plan production profile must not contain automatic Vercel cron jobs.');
  process.exit(1);
}
if (!routeSource.includes('isValidCronSecret')) {
  console.error('✗ Manual/protected cron-compatible endpoints lost CRON_SECRET validation.');
  process.exit(1);
}
for (const slug of ['automation-pipeline','continuous-monitoring','collector-sync','sync-youtube','check-price-drops']) {
  if (!routeSource.includes(`segments[1] === '${slug}'`)) {
    console.error(`✗ Protected maintenance endpoint missing: ${slug}`);
    process.exit(1);
  }
}
console.log('✓ Vercel free-plan cron audit passed: 0 background cron jobs; protected maintenance endpoints preserved.');
