import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createUnsubscribeToken, verifyUnsubscribeToken } from '../../src/lib/unsubscribe-token';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-at-least-long-enough-for-tests';

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test('unsubscribe token validates the intended email and phone', () => {
  const token = createUnsubscribeToken('User@Example.com', 'phone-123');
  assert.equal(verifyUnsubscribeToken('user@example.com', 'phone-123', token), true);
});

test('unsubscribe token rejects a different email', () => {
  const token = createUnsubscribeToken('user@example.com', 'phone-123');
  assert.equal(verifyUnsubscribeToken('attacker@example.com', 'phone-123', token), false);
});

test('unsubscribe token rejects a different phone', () => {
  const token = createUnsubscribeToken('user@example.com', 'phone-123');
  assert.equal(verifyUnsubscribeToken('user@example.com', 'phone-456', token), false);
});

test('public unsubscribe handler requires a signed token', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/app/api/[[...path]]/handlers/public.ts'), 'utf8');
  assert.match(source, /verifyUnsubscribeToken\(email, phoneId, token\)/);
  assert.match(source, /status: 403/);
});

test('all generated unsubscribe links include a token', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/app/api/[[...path]]/route.ts'), 'utf8');
  const templateLinks = [...source.matchAll(/`\$\{siteUrl\}\/api\/price-alerts\/unsubscribe\?[^`]+`/g)].map((match) => match[0]);
  assert.ok(templateLinks.length >= 2);
  for (const link of templateLinks) assert.match(link, /token=\$\{unsubscribeToken\}/);
});

test('health endpoint is present and does not expose environment values', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/app/api/[[...path]]/route.ts'), 'utf8');
  assert.match(source, /segments\[0\] === 'health'/);
  assert.match(source, /status: 'ok'/);
  assert.doesNotMatch(source, /health[\s\S]{0,500}process\.env\.MONGO/);
});

test('public API caching is not globally disabled', () => {
  const config = fs.readFileSync(path.join(process.cwd(), 'next.config.ts'), 'utf8');
  assert.doesNotMatch(config, /source:\s*['"]\/api\/:path\*['"]/);
  assert.match(config, /\/api\/admin\/:path\*/);
});

console.log(`\nCheckpoint 6 Batch 3: ${passed}/7 checks passed`);
