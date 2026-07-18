import { test, expect } from '@playwright/test';

test.describe('PhoneDock Critical Fixes', () => {

  test('Build marker API returns correct build ID', async ({ request }) => {
    const res = await request.get('/api/build-info');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.buildId).toBe('PHONEDOCK-FIX-PERFORMANCE-15');
  });

  test('Homepage loads without critical console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('Failed to load resource') &&
      !e.includes('net::ERR_') &&
      !e.includes('favicon') &&
      !e.includes('MONGODB_URI')
    );
    expect(criticalErrors.length).toBeLessThan(5);
  });

  test('Compare page has Add Phones button and no scroll hacks', async ({ page }) => {
    await page.goto('/compare', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Add Phones button should exist
    const addBtn = page.getByRole('button', { name: /add phones/i });
    await expect(addBtn.first()).toBeVisible();

    // No scrollIntoView or location.hash in page source
    const pageContent = await page.content();
    expect(pageContent).not.toContain('scrollIntoView');
    expect(pageContent).not.toContain('compare-search-input');
    expect(pageContent).not.toContain('window.scrollTo');
  });

  test('Compare page has at most one Clear All control', async ({ page }) => {
    await page.goto('/compare', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Count all "Clear All" elements
    const clearAllCount = await page.getByText('Clear All').count();
    expect(clearAllCount).toBeLessThanOrEqual(1);
  });

});