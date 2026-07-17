/**
 * SSRF Guard — Unit Tests
 *
 * Tests cover all SSRF protection functions:
 *  - safeHostname: valid/invalid URL extraction
 *  - isPrivateUrl: IP-based private range detection
 *  - isDomainAllowed: domain whitelist matching (including subdomains)
 *  - validateUrlForFetch: full validation pipeline (protocol + domain + IP)
 *
 * Run: npx tsx scripts/__tests__/ssrf-guard.test.ts
 */

import {
  safeHostname,
  isPrivateUrl,
  isDomainAllowed,
  validateUrlForFetch,
} from '../../src/lib/ssrf-guard';

let passed = 0;
let failed = 0;
let errors: string[] = [];

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    errors.push(name);
    console.log(`  ✗ ${name}`);
  }
}

(async () => {

// ─── safeHostname tests ─────────────────────────────────────

console.log('\n=== safeHostname ===');

assert(safeHostname('https://daraz.pk/products/123') === 'daraz.pk', 'HTTPS URL extracts hostname');
assert(safeHostname('http://example.com/page') === 'example.com', 'HTTP URL extracts hostname');
assert(safeHostname('ftp://evil.com') === null, 'FTP protocol rejected');
assert(safeHostname('not-a-url') === null, 'Invalid URL returns null');
assert(safeHostname('') === null, 'Empty string returns null');
assert(safeHostname('https://user:pass@host.com/path') === 'host.com', 'URL with auth extracts hostname');
assert(safeHostname('https://sub.domain.example.co.uk/path?q=1') === 'sub.domain.example.co.uk', 'Subdomain URL extracts full hostname');

// ─── isPrivateUrl tests (IP literals — no DNS needed) ────────

console.log('\n=== isPrivateUrl (IP-based checks) ===');

const ipTests: Array<{ url: string; expected: boolean; name: string }> = [
  { url: 'http://127.0.0.1/', expected: true, name: '127.0.0.1 is private' },
  { url: 'http://127.255.255.255/', expected: true, name: '127.x.x.x is private' },
  { url: 'http://10.0.0.1/', expected: true, name: '10.0.0.1 is private (RFC 1918)' },
  { url: 'http://10.255.255.255/', expected: true, name: '10.255.255.255 is private' },
  { url: 'http://172.16.0.1/', expected: true, name: '172.16.0.1 is private' },
  { url: 'http://172.31.255.255/', expected: true, name: '172.31.255.255 is private' },
  { url: 'http://172.32.0.1/', expected: false, name: '172.32.0.1 is public' },
  { url: 'http://192.168.0.1/', expected: true, name: '192.168.0.1 is private' },
  { url: 'http://192.168.255.255/', expected: true, name: '192.168.255.255 is private' },
  { url: 'http://169.254.0.1/', expected: true, name: '169.254.0.1 is link-local' },
  { url: 'http://0.0.0.0/', expected: true, name: '0.0.0.0 is reserved' },
  { url: 'http://224.0.0.1/', expected: true, name: '224.0.0.1 is multicast' },
  { url: 'http://100.64.0.1/', expected: true, name: '100.64.0.1 is CGNAT' },
  { url: 'http://192.169.0.1/', expected: false, name: '192.169.0.1 is public' },
  { url: 'http://172.15.255.255/', expected: false, name: '172.15.x.x is public' },
];

for (const t of ipTests) {
  try {
    const result = await isPrivateUrl(t.url);
    if (result === t.expected) {
      passed++;
      console.log(`  ✓ ${t.name}`);
    } else {
      failed++;
      errors.push(t.name);
      console.log(`  ✗ ${t.name} — got ${result}, expected ${t.expected}`);
    }
  } catch (e: any) {
    failed++;
    errors.push(t.name);
    console.log(`  ✗ ${t.name} — ${e.message}`);
  }
}

// ─── isDomainAllowed tests ──────────────────────────────────

console.log('\n=== isDomainAllowed ===');

assert(isDomainAllowed('https://any-domain.com/path', []) === true, 'Empty allowlist allows all domains');
assert(isDomainAllowed('https://evil.com', []) === true, 'Empty allowlist allows evil.com');
assert(isDomainAllowed('https://daraz.pk/product/1', ['daraz.pk']) === true, 'Exact domain match');
assert(isDomainAllowed('https://www.daraz.pk/product/1', ['daraz.pk']) === true, 'Subdomain match');
assert(isDomainAllowed('https://shop.daraz.pk/item', ['daraz.pk']) === true, 'Deep subdomain match');
assert(isDomainAllowed('https://notdaraz.pk/', ['daraz.pk']) === false, 'Similar but different domain rejected');
assert(isDomainAllowed('https://priceoye.pk/phone', ['daraz.pk', 'priceoye.pk']) === true, 'Match in multi-domain list');
assert(isDomainAllowed('https://evil.com/', ['daraz.pk', 'priceoye.pk']) === false, 'No match in multi-domain list');
assert(isDomainAllowed('https://daraz.pk/', ['.daraz.pk']) === true, 'Dot-prefixed domain matches base');
assert(isDomainAllowed('https://www.daraz.pk/', ['.daraz.pk']) === true, 'Dot-prefixed domain matches subdomain');
assert(isDomainAllowed('not-a-url', ['daraz.pk']) === false, 'Invalid URL rejected');
assert(isDomainAllowed('ftp://daraz.pk/', ['daraz.pk']) === false, 'Non-HTTP(S) protocol rejected');

// ─── validateUrlForFetch tests ──────────────────────────────

console.log('\n=== validateUrlForFetch ===');

const vfTests: Array<{ fn: () => Promise<boolean>; name: string }> = [
  async () => { const r = await validateUrlForFetch('https://daraz.pk/product/1'); return r.safe === true; },
  async () => { const r = await validateUrlForFetch('ftp://daraz.pk/product/1'); return r.safe === false && r.reason === 'Only HTTP(S) URLs are allowed'; },
  async () => { const r = await validateUrlForFetch('https://127.0.0.1/admin'); return r.safe === false; },
  async () => { const r = await validateUrlForFetch('https://daraz.pk/product/1', ['priceoye.pk']); return r.safe === false && r.reason === 'Domain not in allowed list'; },
  async () => { const r = await validateUrlForFetch('https://daraz.pk/product/1', ['daraz.pk']); return r.safe === true; },
  async () => { const r = await validateUrlForFetch('http://192.168.1.1/admin'); return r.safe === false; },
  async () => { const r = await validateUrlForFetch('http://10.0.0.1/admin'); return r.safe === false; },
  async () => { const r = await validateUrlForFetch('http://172.16.0.1/'); return r.safe === false; },
  async () => { const r = await validateUrlForFetch('http://169.254.1.1/'); return r.safe === false; },
];

const vfNames = [
  'Valid HTTPS URL with no domain restriction passes',
  'FTP URL rejected',
  'localhost IP rejected',
  'Domain not in allowed list is rejected',
  'Domain in allowed list passes',
  'Private IP 192.168.x.x rejected',
  'Private IP 10.x.x.x rejected',
  'Private IP 172.16.x.x rejected',
  'Link-local 169.254.x.x rejected',
];

for (let i = 0; i < vfTests.length; i++) {
  try {
    const result = await vfTests[i]();
    if (result) {
      passed++;
      console.log(`  ✓ ${vfNames[i]}`);
    } else {
      failed++;
      errors.push(vfNames[i]);
      console.log(`  ✗ ${vfNames[i]}`);
    }
  } catch (e: any) {
    failed++;
    errors.push(vfNames[i]);
    console.log(`  ✗ ${vfNames[i]} — ${e.message}`);
  }
}

// ─── Summary ─────────────────────────────────────────────────

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (errors.length > 0) {
  console.log('\nFailed tests:');
  errors.forEach(e => console.log(`  - ${e}`));
}
console.log(`${'='.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);

})();