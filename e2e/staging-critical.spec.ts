import { test, expect } from '@playwright/test';

test('public comparison remains reachable', async ({ page }) => {
  const response = await page.goto('/compare');
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator('body')).toContainText(/compare/i);
});

const deployedStagingTest = process.env.TEST_BASE_URL || process.env.E2E_BASE_URL ? test : test.skip;
const userCredentialTest = process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD ? test : test.skip;
const adminCredentialTest = process.env.E2E_ADMIN_COOKIE ? test : test.skip;

deployedStagingTest('login rejects an invalid account safely', async ({ request }) => {
  const response = await request.post('/api/account/login', {
    data: { email: `missing-${Date.now()}@example.invalid`, password: 'Invalid1234' },
  });
  expect([400, 401, 429]).toContain(response.status());
  const body = await response.json();
  expect(body.error).toBeTruthy();
  expect(JSON.stringify(body)).not.toMatch(/stack|mongodb|mongoose/i);
});

userCredentialTest('authenticated account flow', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(process.env.E2E_USER_EMAIL!);
  await page.getByLabel(/password/i).fill(process.env.E2E_USER_PASSWORD!);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await expect(page).toHaveURL(/account/);
});

adminCredentialTest('admin role matrix endpoint', async ({ request }) => {
  const response = await request.get('/api/admin/me', {
    headers: { cookie: process.env.E2E_ADMIN_COOKIE! },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.admin?.role ?? body.role).toMatch(/superadmin|admin|editor|viewer/);
});
