import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const features = read('src/app/api/account/features/route.ts');
const profile = read('src/app/api/account/profile/route.ts');
const models = read('src/lib/models/UserFeatures.ts');
const user = read('src/lib/models/User.ts');
const login = read('src/app/api/account/login/route.ts');

for (const name of ['Wishlist', 'Favorite', 'RecentlyViewed', 'CompareHistory', 'Notification']) assert.match(models, new RegExp(`export const ${name}`));
assert.match(models, /userId: 1, phoneId: 1[\s\S]*unique: true/, 'synced phone lists prevent duplicates');
assert.match(models, /userId: 1, viewedAt: -1/, 'recent history needs deterministic cleanup order');
assert.match(features, /getUserId\(req\)/, 'feature APIs require the authenticated user');
assert.match(features, /userId, phoneId/, 'writes must be ownership scoped');
assert.match(features, /userId, _id: id/, 'comparison deletion must be ownership scoped');
assert.match(features, /private, no-store/, 'private account data must never enter public caches');
assert.match(features, /\.limit\(100\)/, 'user collections must be bounded');
assert.match(profile, /withTransaction/, 'account deletion must be transactional');
assert.match(profile, /sessionVersion: 1/, 'account deletion must revoke sessions');
assert.match(user, /notificationSettings[\s\S]*privacySettings/, 'user preferences must be persisted');
assert.match(login, /remember[\s\S]*userCookieOptionsFor/, 'remember-me must control session lifetime');

console.log('Phase 2 user/business feature tests passed');
