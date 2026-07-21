import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const publicPages = ['/', '/compare', '/faq', '/login', '/signup'];

test.describe.configure({ mode: 'serial' });

for (const path of publicPages) {
  test(`${path} has no serious or critical accessibility violations`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response?.ok()).toBeTruthy();
    await page.waitForTimeout(300);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blocking = results.violations.filter((violation) =>
      violation.impact === 'critical' || violation.impact === 'serious'
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
}
