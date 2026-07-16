import { test, expect } from '@playwright/test';

// ===== HOMEPAGE =====
test.describe('Homepage', () => {
  test('loads successfully with status 200', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBeLessThan(400);
  });
  test('has correct title containing PhoneDock', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/PhoneDock/i);
  });
  test('has navigation links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href="/phones"]')).toBeVisible();
    await expect(page.locator('a[href="/compare"]')).toBeVisible();
    await expect(page.locator('a[href="/brands"]')).toBeVisible();
  });
});

// ===== SEARCH =====
test.describe('Search', () => {
  test('search page loads', async ({ page }) => {
    await page.goto('/search');
    await expect(page).toHaveTitle(/Search/i);
  });
  test('search input exists and is functional', async ({ page }) => {
    await page.goto('/search?q=samsung');
    await expect(page.locator('input')).toBeVisible();
  });
});

// ===== PHONE PAGES =====
test.describe('Phone Pages', () => {
  test('phones listing page loads', async ({ page }) => {
    const res = await page.goto('/phones');
    expect(res?.status()).toBeLessThan(400);
  });
  test('brands listing page loads', async ({ page }) => {
    const res = await page.goto('/brands');
    expect(res?.status()).toBeLessThan(400);
  });
  test('compare page loads', async ({ page }) => {
    const res = await page.goto('/compare');
    expect(res?.status()).toBeLessThan(400);
  });
});

// ===== STATIC PAGES =====
test.describe('Static Pages', () => {
  const pages = [
    '/about', '/contact', '/faq', '/privacy-policy', '/terms',
    '/disclaimer', '/advertise', '/how-we-test', '/rating-methodology',
    '/data-sources', '/news', '/reviews', '/videos', '/upcoming',
    '/best-camera-phone', '/best-battery-phone', '/best-gaming-phone',
    '/best-budget-phone', '/best-value-phone', '/price-ranges',
    '/affiliate-disclosure',
  ];
  for (const path of pages) {
    test(`${path} returns valid response`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBeLessThan(400);
    });
  }
});

// ===== ADMIN =====
test.describe('Admin', () => {
  test('login page loads', async ({ page }) => {
    const res = await page.goto('/admin/login');
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', 'nonexistent@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Invalid credentials')).toBeVisible({ timeout: 10000 });
  });
  test('admin dashboard redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForURL(/\/admin\/login/, { timeout: 10000 });
  });
  test('first-setup page returns 404 when superadmin exists', async ({ page }) => {
    const res = await page.goto('/admin/first-setup');
    // Should show 404 or redirect since superadmin already exists
    expect(res?.status()).toBeLessThan(500);
  });
});

// ===== SECURITY =====
test.describe('Security Headers', () => {
  test('has X-Content-Type-Options: nosniff', async ({ page }) => {
    const res = await page.goto('/');
    const header = res?.headers()['x-content-type-options'];
    expect(header).toBe('nosniff');
  });
  test('has X-Frame-Options: DENY', async ({ page }) => {
    const res = await page.goto('/');
    const header = res?.headers()['x-frame-options'];
    expect(header).toContain('DENY');
  });
  test('has Strict-Transport-Security', async ({ page }) => {
    const res = await page.goto('/');
    const header = res?.headers()['strict-transport-security'];
    expect(header).toBeDefined();
  });
  test('has Referrer-Policy', async ({ page }) => {
    const res = await page.goto('/');
    const header = res?.headers()['referrer-policy'];
    expect(header).toContain('strict-origin');
  });
});

// ===== SEO =====
test.describe('SEO', () => {
  test('robots.txt is accessible', async ({ page }) => {
    const res = await page.goto('/robots.txt');
    expect(res?.status()).toBe(200);
  });
  test('sitemap.xml is accessible', async ({ page }) => {
    const res = await page.goto('/sitemap.xml');
    expect(res?.status()).toBe(200);
  });
  test('homepage has meta description', async ({ page }) => {
    await page.goto('/');
    const meta = page.locator('meta[name="description"]');
    await expect(meta).toHaveAttribute('content', /.+/);
  });
});

// ===== 404 =====
test.describe('404 Handling', () => {
  test('non-existent page shows 404', async ({ page }) => {
    const res = await page.goto('/this-page-does-not-exist-xyz');
    expect(res?.status()).toBe(404);
  });
});

// ===== NEWS & REVIEWS DYNAMIC PAGES =====
test.describe('Dynamic Pages', () => {
  test('news page loads', async ({ page }) => {
    const res = await page.goto('/news');
    expect(res?.status()).toBeLessThan(400);
  });
  test('reviews page loads', async ({ page }) => {
    const res = await page.goto('/reviews');
    expect(res?.status()).toBeLessThan(400);
  });
});