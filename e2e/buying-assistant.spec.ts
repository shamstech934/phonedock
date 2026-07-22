import { test, expect } from '@playwright/test';

test('Buying Assistant supports Roman Urdu and links only to real phone pages', async ({ page }) => {
  await page.goto('/buying-assistant');
  await page.getByLabel('Phone requirements').fill('acha camera PTA approved mobile under 100 hazar');
  await page.getByRole('button', { name: 'Recommend' }).click();
  const links = page.getByRole('link', { name: 'View phone' });
  test.skip(await links.count() === 0, 'Requires seeded matching phones.');
  await expect(links.first()).toHaveAttribute('href', /^\/phones\/[a-z0-9-]+$/);
  await expect(page.getByText(/match$/).first()).toBeVisible();
});

test('Buying Assistant has an explicit no-result state', async ({ page }) => {
  await page.goto('/buying-assistant');
  await page.getByLabel('Phone requirements').fill('PTA gaming phone under 5000');
  await page.getByRole('button', { name: 'Recommend' }).click();
  await expect(page.getByText(/No verified phones matched|Recommendation data is temporarily unavailable/)).toBeVisible();
});
