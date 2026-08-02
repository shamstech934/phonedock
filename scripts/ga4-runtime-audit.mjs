import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const growthPath = path.join(root, 'src/components/monetization/GrowthScripts.tsx');
const layoutPath = path.join(root, 'src/app/layout.tsx');
const settingsPath = path.join(root, 'src/app/admin/settings/page.tsx');

const growth = fs.readFileSync(growthPath, 'utf8');
const layout = fs.readFileSync(layoutPath, 'utf8');
const settings = fs.readFileSync(settingsPath, 'utf8');

const checks = [
  ['GA loader', growth.includes('googletagmanager.com/gtag/js')],
  ['CMS or env fallback', growth.includes('NEXT_PUBLIC_GA_MEASUREMENT_ID') && growth.includes('googleAnalyticsId')],
  ['Consent gate', growth.includes("phonedock_cookie_consent_v1") && growth.includes("=== 'accepted'")],
  ['Admin exclusion', growth.includes("pathname.startsWith('/admin')")],
  ['SPA page views', growth.includes("'page_view'") && growth.includes('useSearchParams')],
  ['Duplicate page-view prevention', growth.includes('send_page_view:false')],
  ['Measurement ID validation', growth.includes('GA_ID_PATTERN')],
  ['Root layout integration', layout.includes('<GrowthScripts />')],
  ['Admin setting field', settings.includes('Google Analytics ID')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) process.exit(1);
console.log(`GA4 runtime audit passed (${checks.length}/${checks.length}).`);
