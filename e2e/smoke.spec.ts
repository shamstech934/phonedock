import { test, expect } from '@playwright/test';

// ─── Base URL ─────────────────────────────────────────────────────────────────
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('PhoneDock Smoke Tests', () => {

  test('homepage loads with status 200', async ({ page }) => {
    const res = await page.goto(BASE);
    expect(res?.status()).toBe(200);
    // Page should have a visible heading or phone card
    await page.waitForSelector('h1, .phone-card, [class*="hero"]', { timeout: 15000 });
  });

  test('/phones page loads and shows phone grid', async ({ page }) => {
    const res = await page.goto(`${BASE}/phones`);
    expect(res?.status()).toBe(200);
    // Should have a heading containing "Phones"
    const h1 = page.locator('h1');
    await expect(h1).toContainText(/phones/i);
  });

  test('/brands page loads', async ({ page }) => {
    const res = await page.goto(`${BASE}/brands`);
    expect(res?.status()).toBe(200);
  });

  test('/compare page loads', async ({ page }) => {
    const res = await page.goto(`${BASE}/compare`);
    expect(res?.status()).toBe(200);
    // Should show the compare heading or empty state
    const heading = page.locator('h1');
    await expect(heading).toContainText(/compare/i);
  });

  test('/news page loads', async ({ page }) => {
    const res = await page.goto(`${BASE}/news`);
    expect(res?.status()).toBe(200);
  });

  test('/videos page loads', async ({ page }) => {
    const res = await page.goto(`${BASE}/videos`);
    expect(res?.status()).toBe(200);
  });

  test('/search page loads', async ({ page }) => {
    const res = await page.goto(`${BASE}/search`);
    expect(res?.status()).toBe(200);
  });

  test('/reviews page loads', async ({ page }) => {
    const res = await page.goto(`${BASE}/reviews`);
    expect(res?.status()).toBe(200);
  });

  test('/upcoming page loads', async ({ page }) => {
    const res = await page.goto(`${BASE}/upcoming`);
    expect(res?.status()).toBe(200);
  });

  test('/best-camera-phone page loads', async ({ page }) => {
    const res = await page.goto(`${BASE}/best-camera-phone`);
    expect(res?.status()).toBe(200);
  });

  test('/best-battery-phone page loads', async ({ page }) => {
    const res = await page.goto(`${BASE}/best-battery-phone`);
    expect(res?.status()).toBe(200);
  });

  test('/best-gaming-phone page loads', async ({ page }) => {
    const res = await page.goto(`${BASE}/best-gaming-phone`);
    expect(res?.status()).toBe(200);
  });

  test('/price-ranges page loads', async ({ page }) => {
    const res = await page.goto(`${BASE}/price-ranges`);
    expect(res?.status()).toBe(200);
  });

  test('404 page renders for non-existent route', async ({ page }) => {
    const res = await page.goto(`${BASE}/this-page-does-not-exist-xyz`);
    expect(res?.status()).toBe(404);
    await expect(page.locator('h1')).toContainText(/not found/i);
  });

  test('API health endpoint responds', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('API phones endpoint responds with valid structure', async ({ request }) => {
    const res = await request.get(`${BASE}/api/phones?limit=5`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('phones');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.phones)).toBe(true);
  });

  test('API brands endpoint responds', async ({ request }) => {
    const res = await request.get(`${BASE}/api/brands`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('brands');
    expect(Array.isArray(body.brands)).toBe(true);
  });

  test('security headers are present', async ({ request }) => {
    const res = await request.get(BASE);
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(res.headers()['x-frame-options']).toBe('DENY');
    expect(res.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers()['strict-transport-security']).toBeDefined();
    expect(res.headers()['content-security-policy']).toBeDefined();
  });

  test('admin login page is accessible', async ({ page }) => {
    const res = await page.goto(`${BASE}/admin/login`);
    expect(res?.status()).toBe(200);
    // Should show login form
    await page.waitForSelector('input[type="email"], input[type="text"]', { timeout: 10000 });
  });

  test('admin routes redirect to login when unauthenticated', async ({ page }) => {
    const res = await page.goto(`${BASE}/admin/dashboard`);
    // Should redirect to login
    await page.waitForURL(/\/admin\/login/, { timeout: 10000 });
  });

  test('robots.txt is accessible', async ({ request }) => {
    const res = await request.get(`${BASE}/robots.txt`);
    expect(res.status()).toBe(200);
  });

  test('sitemap.xml is accessible', async ({ request }) => {
    const res = await request.get(`${BASE}/sitemap.xml`);
    expect(res.status()).toBe(200);
  });
});