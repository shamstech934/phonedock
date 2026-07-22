import { test, expect } from '@playwright/test';

const widths = [320, 375, 768, 1024, 1440, 1920];

for (const width of [768, 1024, 1440, 1920]) {
  test(`catalogue card actions stay inside the card with price sidebar at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/phones?priceCategory=mid-range', { waitUntil: 'domcontentloaded' });
    const cards = page.getByTestId('phone-card');
    test.skip(await cards.count() === 0, 'Requires seeded catalogue records.');

    const containment = await cards.evaluateAll(nodes => nodes.slice(0, 8).map(node => {
      const card = node.getBoundingClientRect();
      const actions = node.querySelector('[data-testid="phone-card-actions"]')!.getBoundingClientRect();
      const quickView = node.querySelector('[data-testid="quick-view-action"]')?.getBoundingClientRect();
      return {
        actionsInside: actions.left >= card.left - 1 && actions.right <= card.right + 1,
        quickViewInside: !quickView || quickView.right <= card.right + 1,
      };
    }));

    expect(containment.every(result => result.actionsInside && result.quickViewInside)).toBeTruthy();
  });
}

for (const width of widths) {
  test(`camera ranking cards align and remain clickable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/best-camera-phone', { waitUntil: 'domcontentloaded' });
    const cards = page.getByTestId('phone-card');
    const count = await cards.count();
    test.skip(count < 2, 'Requires at least two seeded ranking records.');

    const heights = await cards.evaluateAll(nodes => nodes.slice(0, 4).map(node => Math.round(node.getBoundingClientRect().height)));
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    const actionY = await cards.evaluateAll(nodes => nodes.slice(0, 4).map(node => Math.round(node.querySelector('[data-testid="phone-card-actions"]')!.getBoundingClientRect().y)));
    expect(Math.max(...actionY) - Math.min(...actionY)).toBeLessThanOrEqual(1);
    const specsHeights = await cards.evaluateAll(nodes => nodes.slice(0, 4).map(node => Math.round(node.querySelector('[data-testid="phone-card-specs"]')!.getBoundingClientRect().height)));
    expect(new Set(specsHeights).size).toBe(1);
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

test('smart alternatives reserve equal specs space and align actions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto('/phones', { waitUntil: 'domcontentloaded' });
  const firstPhone = page.getByTestId('phone-card-link').first();
  test.skip(await firstPhone.count() === 0, 'Requires at least one seeded phone.');
  await firstPhone.click();

  const grid = page.getByTestId('smart-alternatives-grid');
  test.skip(await grid.count() === 0, 'Selected phone has no Smart Alternatives.');
  const cards = grid.getByTestId('phone-card');
  test.skip(await cards.count() < 2, 'Requires at least two Smart Alternatives.');

  const metrics = await cards.evaluateAll(nodes => nodes.map(node => {
    const card = node.getBoundingClientRect();
    const specs = node.querySelector('[data-testid="phone-card-specs"]')!.getBoundingClientRect();
    const actions = node.querySelector('[data-testid="phone-card-actions"]')!.getBoundingClientRect();
    return { cardHeight: Math.round(card.height), specsHeight: Math.round(specs.height), actionY: Math.round(actions.y), actionsBottom: Math.round(actions.bottom), specsOverflow: specs.scrollHeight > specs.clientHeight };
  }));
  expect(new Set(metrics.map(metric => metric.cardHeight)).size).toBe(1);
  expect(new Set(metrics.map(metric => metric.specsHeight)).size).toBe(1);
  expect(new Set(metrics.map(metric => metric.actionY)).size).toBe(1);
  expect(new Set(metrics.map(metric => metric.actionsBottom)).size).toBe(1);
  expect(metrics.every(metric => !metric.specsOverflow)).toBeTruthy();
});
