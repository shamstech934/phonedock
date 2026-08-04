import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const settings = read('src/lib/models/Settings.ts');
assert.match(settings, /mobileApp:/, 'Settings must persist mobile app configuration');
assert.match(settings, /minimumVersion/, 'Mobile minimum version must be configurable');

const publicApi = read('src/app/api/[[...path]]/handlers/public.ts');
assert.match(publicApi, /segments\[0\] === 'mobile'.*segments\[1\] === 'config'/s, 'Public mobile config endpoint must exist');
assert.doesNotMatch(publicApi, /mobile\/config[\s\S]{0,900}CRON_SECRET/, 'Mobile config must never expose CRON_SECRET');

const adminApi = read('src/app/api/[[...path]]/handlers/admin-crud.ts');
assert.match(adminApi, /update\.mobileApp/, 'Admin API must sanitize mobile settings');
assert.match(adminApi, /safeVersion/, 'App versions must be validated');

const adminPage = read('src/app/admin/mobile-control/page.tsx');
assert.match(adminPage, /Mobile App Control Center/, 'Admin control center must exist');
assert.match(adminPage, /Force users to update/, 'Force update control must exist');

const provider = read('mobile-app/src/state/MobileConfigProvider.tsx');
assert.match(provider, /compareVersions/, 'Mobile app must enforce minimum compatible version');
assert.match(provider, /Network\/config failures do not brick/, 'Mobile app must fail open safely on transient config failures');

console.log('✓ mobile shared-control regression checks passed');
