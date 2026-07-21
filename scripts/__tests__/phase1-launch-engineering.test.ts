import assert from 'node:assert/strict';

async function main() {
process.env.JWT_SECRET ||= 'phase-1-test-secret-that-is-longer-than-32-characters';

const { createUserToken, readUserToken } = await import('../../src/lib/user-auth');
const { parseBoundedInt } = await import('../../src/lib/http');

const token = await createUserToken({
  id: '507f1f77bcf86cd799439011',
  email: 'user@example.com',
  name: 'Test User',
  sessionVersion: 4,
});
const payload = await readUserToken(token);
assert.equal(payload.sub, '507f1f77bcf86cd799439011');
assert.equal(payload.aud, 'phonedock-user');
assert.equal(payload.iss, 'phonedock');
assert.equal(payload.sessionVersion, 4);

await assert.rejects(
  () => readUserToken(`${token}tampered`),
  /signature|Invalid|token/i,
);

assert.equal(parseBoundedInt('12', 1, { max: 20 }), 12);
assert.equal(parseBoundedInt('abc', 7, { max: 20 }), 7);
assert.equal(parseBoundedInt('-1', 7, { max: 20 }), 7);
assert.equal(parseBoundedInt('1.5', 7, { max: 20 }), 7);
assert.equal(parseBoundedInt('999', 7, { max: 20 }), 20);

console.log('Phase 1 launch-engineering tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
