import { test, expect } from '@playwright/test';

const widths = [320, 375, 768, 1024, 1440, 1920];

for (const width of widths) {
  test(`camera ranking cards align and remain clickable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/best-camera-phone', { waitUntil: 'domcontentloaded' });
    const cards = page.getByTestId('phone-card');
    const count = await cards.count();
    test.skip(count < 2, 'Requires at least two seeded ranking records.');

    const heights = await cards.evaluateAll(nodes => nodes.slice(0, 4).map(node => Math.round(node.getBoundingClientRect().height)));
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    const first = cards.first();
    const category = first.getByTestId('category-score');
    const overall = first.getByTestId('overall-rating');
    if (await category.count() && await overall.count()) {
      const [a, b] = await Promise.all([category.boundingBox(), overall.boundingBox()]);
      expect(a && b && (a.y + a.height <= b.y || b.y + b.height <= a.y)).toBeTruthy();
    }
    const bodyLink = first.getByTestId('phone-card-link');
    await expect(bodyLink).toHaveAttribute('href', /^\/phones\//);
    await bodyLink.focus();
    await expect(bodyLink).toBeFocused();
  });
}

test('gaming ranking action controls remain independent', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 1000 });
  await page.goto('/best-gaming-phone', { waitUntil: 'domcontentloaded' });
  const card = page.getByTestId('phone-card').first();
  test.skip(await card.count() === 0, 'Requires seeded ranking records.');
  const rankingUrl = page.url();
  await card.getByTestId('wishlist-action').click();
  expect(page.url()).toBe(rankingUrl);
  await card.getByTestId('quick-view-action').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await card.getByTestId('compare-action').click();
  await expect(page).toHaveURL(/\/compare\?p=/);
});

test('camera ranking image and title use the detail link', async ({ page }) => {
  await page.goto('/best-camera-phone', { waitUntil: 'domcontentloaded' });
  const card = page.getByTestId('phone-card').first();
  test.skip(await card.count() === 0, 'Requires seeded ranking records.');
  const href = await card.getByTestId('phone-card-link').getAttribute('href');
  await card.getByTestId('phone-card-image').click();
  await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await page.goBack();
  await page.getByTestId('phone-card').first().getByTestId('phone-card-title').click();
  await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
});
