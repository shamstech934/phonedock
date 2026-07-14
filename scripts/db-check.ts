/**
 * MongoDB Diagnostic Command — PhoneDock
 *
 * Usage: npm run db:check
 */

import { loadScriptEnv, validateMongoUri, classifyMongoError, checkDns, testConnection } from '../src/lib/mongodb-env';

loadScriptEnv();

async function main() {

const uri = process.env.MONGODB_URI;

console.log('\n╔═══════════════════════════════════════════╗');
console.log('║   PhoneDock — MongoDB Diagnostics       ║');
console.log('╚═══════════════════════════════════════════╝\n');

// ---- Step 1: Validate URI ----
console.log('── Step 1: URI Validation ──');
const validation = validateMongoUri(uri);

if (!validation.valid) {
  console.log(`  [FAIL] ${validation.error}`);
  console.log(`  URI: ${validation.masked}`);
  console.log('\n  Fix: Copy the full connection string from MongoDB Atlas > Connect > Drivers.');
  console.log('  Then run: vercel env pull .env.local  (or create .env.local manually)\n');
  process.exit(1);
}

console.log(`  [OK]   URI is valid`);
console.log(`  Protocol:  ${validation.protocol}`);
console.log(`  Hostname:  ${validation.hostname}`);
console.log(`  Database:  ${validation.database}`);
console.log(`  URI:       ${validation.masked}`);

// ---- Step 2: DNS Resolution ----
console.log('\n── Step 2: DNS Resolution ──');
const isSrv = validation.protocol === 'mongodb+srv://';

const dnsResult = await checkDns(validation.hostname, isSrv);

if (dnsResult.success) {
  console.log(`  [OK]   ${dnsResult.message}`);
} else {
  console.log(`  [FAIL] ${dnsResult.message}`);
}

if (dnsResult.windowsCommand) {
  console.log(`  Windows: ${dnsResult.windowsCommand}`);
}

// ---- Step 3: MongoDB Connection (read-only ping) ----
console.log('\n── Step 3: Connection Test (ping) ──');

const connResult = await testConnection(uri!);

if (connResult.success) {
  console.log(`  [OK]   ${connResult.message}`);
  console.log(`  Database: ${connResult.database}`);
} else {
  console.log(`  [FAIL] ${connResult.message}`);
  const classified = classifyMongoError(new Error(connResult.message), validation);
  console.log(`\n  Category: ${classified.category}`);
  console.log(`  ${classified.message}`);
  console.log('\n  Guidance:');
  for (const line of classified.guidance) {
    console.log(`    - ${line}`);
  }
}

// ---- Windows Diagnostic Commands ----
console.log('\n── Windows Diagnostics ──');
console.log('  Run these in CMD if you are on Windows:\n');
console.log(`  ipconfig /flushdns`);
if (isSrv && validation.hostname) {
  console.log(`  nslookup -type=SRV _mongodb._tcp.${validation.hostname}`);
} else if (validation.hostname) {
  const h = validation.hostname.split(':')[0];
  console.log(`  nslookup ${h}`);
}
console.log('');

// ---- Summary ----
console.log('═══════════════════════════════════════════');
if (connResult.success) {
  console.log('  RESULT: All checks passed. Database is reachable.');
  console.log(`  Database: ${connResult.database}`);
} else if (dnsResult.success && !connResult.success) {
  console.log('  RESULT: DNS works but MongoDB connection failed.');
  console.log('  This usually means wrong credentials, blocked IP, or paused cluster.');
} else if (!dnsResult.success) {
  console.log('  RESULT: DNS resolution failed. Check your internet and the URI.');
} else {
  console.log('  RESULT: Checks could not complete.');
}
console.log('═══════════════════════════════════════════\n');

process.exit(connResult.success ? 0 : 1);
}

main();