import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const proxy = read('src/proxy.ts');
const client = read('src/lib/public-settings-client.ts');
const header = read('src/components/shared/Header.tsx');
const footer = read('src/components/shared/Footer.tsx');
const growth = read('src/components/monetization/GrowthScripts.tsx');
const settings = read('src/lib/models/Settings.ts');
const adminCrud = read('src/app/api/[[...path]]/handlers/admin-crud.ts');

assert.match(proxy, /api\(\?:\/\|\$\)/, 'public proxy matcher must exclude API routes');
assert.match(proxy, /\.\*\\\.\[\^\/\]\+\$/, 'public proxy matcher must exclude public files');
assert.match(proxy, /'\/api\/admin\/:path\*'/, 'admin API routes must remain protected');

assert.equal((client.match(/fetch\('\/api\/settings'\)/g) || []).length, 1, 'shared client must own one settings fetch');
assert.match(client, /if \(inFlight\) return inFlight/, 'concurrent settings consumers must share one request');
for (const [name, source] of [['Header', header], ['Footer', footer], ['GrowthScripts', growth]] as const) {
  assert.doesNotMatch(source, /fetch\('\/api\/settings'/, `${name} must not start a duplicate settings request`);
  assert.match(source, /getPublicSettings\(/, `${name} must use the shared settings loader`);
}

assert.match(settings, /SETTINGS_CACHE_TTL_MS = 60_000/, 'server settings cache must remain short-lived');
assert.match(settings, /cache\?\.inFlight/, 'cold settings reads must be coalesced');
assert.match(settings, /export function invalidateSettingsCache/, 'settings cache needs explicit invalidation');
assert.match(adminCrud, /invalidateSettingsCache\(\)/, 'CMS saves must invalidate the server settings cache');

console.log('invocation optimization regression tests passed');
