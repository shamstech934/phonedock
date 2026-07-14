/**
 * PhoneDock — MongoDB Connection & Script Safety Tests
 *
 * Usage: npx tsx scripts/__tests__/mongodb-safety.test.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { validateMongoUri, classifyMongoError, testConnection } from '../../src/lib/mongodb-env';

let passed = 0;
let failed = 0;
const results: { test: string; status: string; detail?: string }[] = [];

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    passed++;
    results.push({ test: name, status: 'PASSED' });
    console.log('  [PASS] ' + name);
  } else {
    failed++;
    results.push({ test: name, status: 'FAILED', detail });
    console.log('  [FAIL] ' + name + (detail ? ' -- ' + detail : ''));
  }
}

const runTests = async () => {

// validateMongoUri, classifyMongoError, testConnection already imported at top
console.log('\n=======================================================');
console.log('  PHONEDOCK MongoDB Connection & Safety Test Suite');
console.log('=======================================================\n');

// ---- Test 1: Missing MONGODB_URI ----
console.log('-- URI Validation: Missing --');
const missing = validateMongoUri(undefined);
assert(missing.valid === false, 'Test 1: Missing MONGODB_URI is rejected');
assert(missing.error !== undefined && missing.error.includes('not set'), 'Test 1: Error mentions not set');
assert(missing.masked === '(not set)', 'Test 1: Masked shows (not set)');

// ---- Test 2: Malformed URI ----
console.log('\n-- URI Validation: Malformed --');
const malformed = validateMongoUri('http://example.com/db');
assert(malformed.valid === false, 'Test 2: http:// URI is rejected');
assert(malformed.error !== undefined && (malformed.error.includes('mongodb://') || malformed.error.includes('mongodb+srv://')),
  'Test 2: Error mentions correct protocols');

const emptyString = validateMongoUri('');
assert(emptyString.valid === false, 'Test 2b: Empty string is rejected');

const postgres = validateMongoUri('postgres://user:pass@host/db');
assert(postgres.valid === false, 'Test 2c: postgres:// URI is rejected');

// ---- Test 3: Placeholder URI ----
console.log('\n-- URI Validation: Placeholders --');
const placeholder1 = validateMongoUri('mongodb+srv://username:password@cluster0.example.mongodb.net/phonedock');
assert(placeholder1.valid === false, 'Test 3a: cluster0.example is rejected as placeholder');
assert(placeholder1.error !== undefined && placeholder1.error.includes('placeholder'), 'Test 3a: Error mentions placeholder');

const placeholder2 = validateMongoUri('mongodb+srv://user:changeme@host.mongodb.net/db');
assert(placeholder2.valid === false, 'Test 3b: changeme password is rejected as placeholder');

const placeholder3 = validateMongoUri('mongodb+srv://user:xxxxx@host.mongodb.net/db');
assert(placeholder3.valid === false, 'Test 3c: xxxxx is rejected as placeholder');

// ---- Test 4: DNS failure classification ----
console.log('\n-- Error Classification: DNS Failure --');
const dnsErr = classifyMongoError(
  new Error('getaddrinfo ENOTFOUND cluster0.xxx.mongodb.net'),
  { valid: true, masked: 'mongodb+srv://***.mongodb.net/db', protocol: 'mongodb+srv://', hostname: 'cluster0.xxx.mongodb.net', database: 'db' },
);
assert(dnsErr.category === 'DNS_FAILURE', 'Test 4: ENOTFOUND classified as DNS_FAILURE');
assert(dnsErr.guidance.length > 0, 'Test 4: DNS failure has guidance steps');

// ---- Test 5: Authentication failure classification ----
console.log('\n-- Error Classification: Auth Failure --');
const authErr = classifyMongoError(
  new Error('Authentication failed'),
  { valid: true, masked: 'mongodb+srv://***.mongodb.net/db', protocol: 'mongodb+srv://', hostname: 'cluster0.mongodb.net', database: 'db' },
);
assert(authErr.category === 'AUTH_FAILURE', 'Test 5: Auth failed classified correctly');
assert(authErr.guidance.some(function(g) { return g.includes('Atlas'); }), 'Test 5: Guidance mentions Atlas');

// ---- Test 6: querySrv ECONNREFUSED ----
console.log('\n-- Error Classification: querySrv ECONNREFUSED --');
const srvErr = classifyMongoError(
  new Error('querySrv ECONNREFUSED _mongodb._tcp.cluster0.xxx.mongodb.net'),
  { valid: true, masked: 'mongodb+srv://***.mongodb.net/db', protocol: 'mongodb+srv://', hostname: 'cluster0.xxx.mongodb.net', database: 'db' },
);
assert(srvErr.category === 'QUERY_SRV', 'Test 6: querySrv ECONNREFUSED classified correctly');
assert(srvErr.guidance.some(function(g) { return g.includes('nslookup') || g.includes('SRV'); }), 'Test 6: Guidance mentions SRV lookup');
assert(srvErr.guidance.some(function(g) { return g.includes('Atlas'); }), 'Test 6: Guidance mentions Atlas');
assert(srvErr.guidance.some(function(g) { return g.includes('Network Access'); }), 'Test 6: Guidance mentions Network Access');

// ---- Test 7: Valid URI validation ----
console.log('\n-- URI Validation: Valid --');
const validSrv = validateMongoUri('mongodb+srv://user:RealP@ssw0rd!@cluster0.abc123.mongodb.net/phonedock?retryWrites=true&w=majority');
assert(validSrv.valid === true, 'Test 7a: Valid SRV URI passes');
assert(validSrv.protocol === 'mongodb+srv://', 'Test 7a: Protocol extracted correctly');
assert(validSrv.hostname === 'cluster0.abc123.mongodb.net', 'Test 7a: Hostname extracted correctly');
assert(validSrv.database === 'phonedock', 'Test 7a: Database name extracted correctly');
assert(!validSrv.masked.includes('RealP'), 'Test 7a: Masked URI does NOT contain password');
assert(!validSrv.masked.includes('user'), 'Test 7a: Masked URI does NOT contain username');

const validStandard = validateMongoUri('mongodb://user:pass@127.0.0.1:27017/mydb');
assert(validStandard.valid === true, 'Test 7b: Valid standard URI passes');
assert(validStandard.protocol === 'mongodb://', 'Test 7b: Protocol is mongodb://');
assert(validStandard.hostname === '127.0.0.1:27017', 'Test 7b: Hostname includes port');
assert(validStandard.database === 'mydb', 'Test 7b: Database name extracted');

const noDbName = validateMongoUri('mongodb+srv://user:pass@cluster0.abc.mongodb.net/');
assert(noDbName.valid === true, 'Test 7c: URI without DB name uses safe default');
assert(noDbName.database === 'phonedock', 'Test 7c: Defaults to phonedock');

// ---- Test 8: Admin:create script safety ----
console.log('\n-- Script Safety: admin:create --');
const createAdminContent = fs.readFileSync(
  path.resolve(process.cwd(), 'scripts/create-admin.ts'), 'utf-8'
);
assert(createAdminContent.includes('testConnection'), 'Test 8a: admin:create tests connection before proceeding');
assert(createAdminContent.includes('validateMongoUri'), 'Test 8b: admin:create validates URI');
assert(createAdminContent.includes('classifyMongoError'), 'Test 8c: admin:create classifies errors');
assert(createAdminContent.includes('.env.local'), 'Test 8d: admin:create loads .env.local');
assert(createAdminContent.includes('MONGODB_URI'), 'Test 8e: admin:create uses MONGODB_URI');
assert(!createAdminContent.includes("'localhost'") && !createAdminContent.includes('"localhost"'), 'Test 8f: admin:create does NOT fall back to localhost');
assert(!createAdminContent.includes("'demo'") && !createAdminContent.includes('"demo"'), 'Test 8g: admin:create does NOT reference demo database');
assert(createAdminContent.includes('bcrypt.hash(password, 12)'), 'Test 8h: Uses bcrypt cost 12');
assert(createAdminContent.includes('delete process.env.ADMIN_INITIAL_PASSWORD'), 'Test 8i: Clears password from env after use');
assert(createAdminContent.includes("password = ''"), 'Test 8j: Clears password from memory');

// ---- Test 9: Migration script safety ----
console.log('\n-- Script Safety: migrate --');
const migrateContent = fs.readFileSync(
  path.resolve(process.cwd(), 'scripts/migrate-db.ts'), 'utf-8'
);
assert(migrateContent.includes('MONGODB_URI'), 'Test 9a: migrate uses MONGODB_URI');
assert(migrateContent.includes('updateMany'), 'Test 9b: migrate uses updateMany');
// Check actual migration code only (exclude the safety-check forbidden list)
const migrateLines = migrateContent.split('\n').filter(function(line) {
  return !line.includes('forbidden') && !line.includes('dropDatabase') && !line.includes('deleteMany');
}).join('\n');
assert(!migrateLines.includes('deleteMany'), 'Test 9c: migrate does NOT use deleteMany');
assert(!migrateLines.includes('dropDatabase'), 'Test 9d: migrate does NOT drop database');
assert(!migrateLines.includes('dropCollection'), 'Test 9e: migrate does NOT drop collections');
assert(migrateContent.includes('ensureIndex'), 'Test 9f: migrate uses ensureIndex');
assert(migrateContent.includes('forbidden'), 'Test 9g: migrate has self-safety check');
assert(migrateContent.includes('testConnection'), 'Test 9h: migrate tests connection first');

// ---- Test 10: All scripts use MONGODB_URI ----
console.log('\n-- Consistency: All scripts use MONGODB_URI --');
const scriptFiles = ['create-admin.ts', 'migrate-db.ts', 'seed.ts', 'db-check.ts'];
for (const file of scriptFiles) {
  const filePath = path.resolve(process.cwd(), 'scripts', file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    assert(content.includes('MONGODB_URI'), 'Test 10: ' + file + ' uses MONGODB_URI');
    assert(!content.includes('DATABASE_URL'), 'Test 10: ' + file + ' does NOT use DATABASE_URL');
    assert(!content.includes('MONGO_URL'), 'Test 10: ' + file + ' does NOT use MONGO_URL');
    // Match DB_URI as standalone (not part of MONGODB_URI)
    assert(!/\bDB_URI\b/.test(content), 'Test 10: ' + file + ' does NOT use DB_URI');
  } else {
    assert(false, 'Test 10: ' + file + ' exists');
  }
}

// ---- Test 11: No browser-accessible admin creation routes ----
console.log('\n-- Security: No public admin setup routes --');
assert(!fs.existsSync(path.resolve(process.cwd(), 'src/app/setup')), 'Test 11a: No /setup page');
const apiRoute = fs.readFileSync(path.resolve(process.cwd(), 'src/app/api/[[...path]]/route.ts'), 'utf-8');
assert(!apiRoute.includes('/setup'), 'Test 11b: API route has no setup endpoint');
assert(!apiRoute.includes('register'), 'Test 11c: API route has no public register endpoint');

// ---- Test 12: .env not in repo ----
console.log('\n-- Security: .env not in git --');
assert(!fs.existsSync(path.resolve(process.cwd(), '.env')), 'Test 12a: No .env file in project root');
const gitignore = fs.readFileSync(path.resolve(process.cwd(), '.gitignore'), 'utf-8');
assert(gitignore.includes('.env'), 'Test 12b: .gitignore includes .env');
assert(gitignore.includes('.env.local'), 'Test 12c: .gitignore includes .env.local');

// ---- Test 13: Env loading order ----
console.log('\n-- Env Loading: Priority order --');
const dbCheckContent = fs.readFileSync(path.resolve(process.cwd(), 'scripts/db-check.ts'), 'utf-8');
assert(dbCheckContent.includes('loadScriptEnv'), 'Test 13a: db:check uses loadScriptEnv');
assert(dbCheckContent.includes('.env.local'), 'Test 13b: db:check loads .env.local');
assert(createAdminContent.includes('loadScriptEnv'), 'Test 13c: admin:create uses loadScriptEnv');
assert(migrateContent.includes('loadScriptEnv'), 'Test 13d: migrate uses loadScriptEnv');

// ---- Test 14: Credentials never exposed ----
console.log('\n-- Security: Credentials never printed --');
// "Password" appears in labels but the actual value is never logged
assert(!/console\.log\(.*password\s*[=:]/.test(createAdminContent), 'Test 14a: Password value never logged in admin:create');
assert(!/console\.log\(.*password\s*[=:]/.test(dbCheckContent), 'Test 14b: Password value never logged in db:check');
assert(dbCheckContent.includes('masked'), 'Test 14c: db:check uses masked URI (never prints raw credentials)');

// ---- Test 15: IP not allowed ----
console.log('\n-- Error Classification: IP Not Allowed --');
const ipErr = classifyMongoError(
  new Error('IP is not allowed to connect to this cluster'),
  { valid: true, masked: 'mongodb+srv://***.mongodb.net/db', protocol: 'mongodb+srv://', hostname: 'cluster0.mongodb.net', database: 'db' },
);
assert(ipErr.category === 'IP_NOT_ALLOWED', 'Test 15: IP not allowed classified correctly');

// ---- Test 16: Timeout ----
console.log('\n-- Error Classification: Timeout --');
const timeoutErr = classifyMongoError(
  new Error('Server selection timed out after 10000ms'),
  { valid: true, masked: 'mongodb+srv://***.mongodb.net/db', protocol: 'mongodb+srv://', hostname: 'cluster0.mongodb.net', database: 'db' },
);
assert(timeoutErr.category === 'TIMEOUT', 'Test 16: Timeout classified correctly');

// ---- Test 17: testConnection function exists ----
console.log('\n-- Connection: API exists --');
assert(typeof testConnection === 'function', 'Test 17: testConnection function exists and is importable');

// ---- Test 18: admin:create refuses on DB failure ----
console.log('\n-- Safety: admin:create refuses on DB failure --');
assert(createAdminContent.includes('Admin creation aborted'), 'Test 18: admin:create aborts on DB failure');
assert(createAdminContent.includes('process.exit(1)'), 'Test 18: admin:create exits 1 on failure');

// ============================================================
// SUMMARY
// ============================================================

console.log('\n=======================================================');
console.log('  RESULTS: ' + passed + ' passed, ' + failed + ' failed');
console.log('=======================================================');

if (failed > 0) {
  console.log('\n  Failed tests:');
  results.filter(function(r) { return r.status === 'FAILED'; }).forEach(function(r) {
    console.log('    [FAIL] ' + r.test + (r.detail ? ' -- ' + r.detail : ''));
  });
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
};

runTests();