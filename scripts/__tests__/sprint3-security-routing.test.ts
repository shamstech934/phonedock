import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed++;
    console.log(`✅ ${name}`);
  } else {
    failed++;
    console.error(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const auth = fs.readFileSync(path.join(root, 'src/app/api/[[...path]]/handlers/admin-auth.ts'), 'utf8');
const route = fs.readFileSync(path.join(root, 'src/app/api/[[...path]]/route.ts'), 'utf8');
const proxy = fs.readFileSync(path.join(root, 'src/proxy.ts'), 'utf8');

check('Change-password route matches the two actual path segments', auth.includes("segments.length === 2 && segments[0] === 'admin' && segments[1] === 'change-password'"));
check('Forgot-password route matches the two actual path segments', auth.includes("segments.length === 2 && segments[0] === 'admin' && segments[1] === 'forgot-password'"));
check('Reset-password route matches the two actual path segments', auth.includes("segments.length === 2 && segments[0] === 'admin' && segments[1] === 'reset-password'"));
check('Password reset rate limiting matches actual paths', route.includes("const isForgotPassword = segments.length === 2") && route.includes("const isResetPassword = segments.length === 2"));
check('Forgot-password UI is public', proxy.includes("pathname === '/admin/forgot-password'"));
check('Reset-password UI is public', proxy.includes("pathname === '/admin/reset-password'"));
check('Cron authentication fails closed when secret is missing', route.includes('if (!configured || !provided) return false;'));
check('Cron routes use configured-secret validator', (route.match(/if \(!isValidCronSecret\(secret\)\)/g) || []).length === 2);
check('Login session persistence is awaited', auth.includes('await persistSessionRecord(admin._id.toString(), session.jti'));
check('Login creates one session record, not duplicate records', (auth.match(/persistSessionRecord\(admin\._id\.toString\(\), session\.jti, requestIp, requestUa\)/g) || []).length === 1);
check('Rotated session persistence is awaited', auth.includes('await persistSessionRecord(admin._id.toString(), newSession.jti'));

console.log(`\nSprint 3 checks: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
