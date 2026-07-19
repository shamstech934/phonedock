import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean) {
  if (condition) { console.log(`✅ ${name}`); passed++; }
  else { console.error(`❌ ${name}`); failed++; }
}
const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const middleware = read('src/middleware.ts');
const helpers = read('src/app/api/[[...path]]/handlers/helpers.ts');
const other = read('src/lib/models/Other.ts');
const route = read('src/app/api/[[...path]]/route.ts');

check('Middleware has no process-local login rate-limit Map', !middleware.includes('loginRateLimitMap') && !middleware.includes('new Map<'));
check('Middleware documents MongoDB-backed API rate limiting', middleware.includes('MongoDB-backed'));
check('Session persistence fails closed instead of swallowing create errors', helpers.includes('await AdminSession.create') && !/persistSessionRecord[\s\S]*?catch\s*\(/.test(helpers.slice(helpers.indexOf('persistSessionRecord'), helpers.indexOf('validateSessionRecord'))));
check('Price alerts enforce one subscription per phone and email', /PriceAlertSchema\.index\(\{ phoneId: 1, email: 1 \}, \{ unique: true \}\)/.test(other));
check('Review endpoint validates email format', route.includes("A valid email address is required"));
check('Review endpoint requires an integer rating', route.includes('Number.isInteger(normalizedRating)'));
check('Review writes normalized rating and email', route.includes('rating: normalizedRating') && route.includes('email: normalizedEmail'));

console.log(`\nCheckpoint 4: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
