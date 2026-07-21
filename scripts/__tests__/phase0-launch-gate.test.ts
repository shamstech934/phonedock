import assert from 'node:assert/strict';

async function main() {
  process.env.JWT_SECRET = 'phase-zero-user-secret-with-more-than-32-characters';

  const { parseBoundedInt } = await import('../../src/lib/http');
  const { createUserToken, readUserToken } = await import('../../src/lib/user-auth');
  const { validateProductionEnvironment } = await import('../../src/lib/env-validation');

  assert.equal(parseBoundedInt(undefined, 20, { max: 100 }), 20);
  assert.equal(parseBoundedInt('', 20, { max: 100 }), 20);
  assert.equal(parseBoundedInt('invalid', 20, { max: 100 }), 20);
  assert.equal(parseBoundedInt('-4', 20, { max: 100 }), 20);
  assert.equal(parseBoundedInt('0', 20, { max: 100 }), 1);
  assert.equal(parseBoundedInt('2.5', 20, { max: 100 }), 20);
  assert.equal(parseBoundedInt('999999999999999999999', 20, { max: 100 }), 20);
  assert.equal(parseBoundedInt('500', 20, { max: 100 }), 100);

  const token = await createUserToken({
    id: '507f1f77bcf86cd799439011', email: 'user@example.com', name: 'User', sessionVersion: 2,
  });
  const payload = await readUserToken(token);
  assert.equal((payload.exp ?? 0) - (payload.iat ?? 0), 7 * 24 * 60 * 60);

  const validEnv = {
    MONGODB_URI: 'mongodb://127.0.0.1:27017/phonedock',
    JWT_SECRET: 'admin-secret-that-is-at-least-thirty-two-characters',
    CRON_SECRET: 'cron-secret-that-is-at-least-thirty-two-characters',
    NEXT_PUBLIC_BASE_URL: 'https://staging.phonedock.pk',
  } as NodeJS.ProcessEnv;
  assert.equal(validateProductionEnvironment(validEnv).valid, true);
  assert.equal(validateProductionEnvironment({ ...validEnv, JWT_SECRET: 'change-me' }).valid, false);
  assert.equal(validateProductionEnvironment({ ...validEnv, NEXT_PUBLIC_BASE_URL: 'http://phonedock.pk' }).valid, false);
  assert.equal(validateProductionEnvironment({ ...validEnv, EMAIL_HOST: 'smtp.example.com' }).valid, false);
  assert.equal(validateProductionEnvironment({ ...validEnv, REQUIRE_USER_EMAIL_VERIFICATION: 'true' }).valid, false);

  console.log('Phase 0 launch-gate tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
