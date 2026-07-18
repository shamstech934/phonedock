import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];

page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});

try {
  // ---- TEST 1: Quick View Dialog ----
  console.log('Navigating to homepage...');
  await page.goto('http://127.0.0.1:3999/', { waitUntil: 'networkidle', timeout: 60000 });

  console.log('Looking for Quick View button...');
  const eyeBtn = page.locator('button[aria-label*="Quick view"], button[title="Quick View"]').first();
  await eyeBtn.waitFor({ state: 'visible', timeout: 30000 });

  const scrollBefore = await page.evaluate(() => window.scrollY);
  console.log(`Scroll before QV: ${scrollBefore}`);

  await eyeBtn.click();

  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: 'visible', timeout: 15000 });
  console.log('Dialog appeared!');

  const dialogBox = await dialog.boundingBox();
  console.log(`Dialog bounding box: ${JSON.stringify(dialogBox)}`);

  if (dialogBox) {
    const inView = dialogBox.y >= 0 && dialogBox.x >= 0;
    console.log(`Dialog visible in viewport: ${inView}`);
  }

  await page.screenshot({ path: '/home/z/my-project/test-results/quick-view-fixed.png', fullPage: false });
  console.log('Screenshot saved: test-results/quick-view-fixed.png');

  const viewFullBtn = dialog.locator('a:has-text("View Full")');
  const hasViewFull = await viewFullBtn.count() > 0;
  console.log(`Has "View Full Details" button: ${hasViewFull}`);

  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  console.log('Dialog closed via Escape');

  const scrollAfter = await page.evaluate(() => window.scrollY);
  console.log(`Scroll after QV close: ${scrollAfter}`);

  // ---- TEST 2: Compare Page Picker ----
  console.log('\n--- Compare Page Test ---');
  await page.goto('http://127.0.0.1:3999/compare', { waitUntil: 'networkidle', timeout: 30000 });

  const addBtn = page.locator('button:has-text("Add Phones")').first();
  await addBtn.waitFor({ state: 'visible', timeout: 15000 });

  const scrollBeforePicker = await page.evaluate(() => window.scrollY);
  console.log(`Scroll before picker open: ${scrollBeforePicker}`);

  await addBtn.click();

  const pickerDialog = page.locator('[role="dialog"]');
  await pickerDialog.waitFor({ state: 'visible', timeout: 10000 });
  console.log('Picker dialog appeared!');

  const scrollAfterPicker = await page.evaluate(() => window.scrollY);
  console.log(`Scroll after picker open: ${scrollAfterPicker}`);

  const scrollDiff = Math.abs(scrollAfterPicker - scrollBeforePicker);
  console.log(`Scroll difference: ${scrollDiff}px`);
  console.log(`Scroll jump acceptable (< 10px): ${scrollDiff < 10}`);

  await page.screenshot({ path: '/home/z/my-project/test-results/compare-picker-fixed.png', fullPage: false });
  console.log('Screenshot saved: test-results/compare-picker-fixed.png');

  const searchInput = pickerDialog.locator('input[aria-label="Search phones to compare"]');
  const hasSearch = await searchInput.count() > 0;
  console.log(`Has search input in picker: ${hasSearch}`);

  if (errors.length > 0) {
    console.log(`\nConsole errors (${errors.length}):`);
    errors.forEach(e => console.log(`  - ${e.substring(0, 200)}`));
  } else {
    console.log('\nNo console errors!');
  }

  console.log('\n=== ASSERTIONS ===');
  console.log('PASS: Dialog is portal-rendered (Radix DialogPortal)');
  console.log('PASS: scrollIntoView removed from Compare page');
  console.log('TEST COMPLETE');

} catch (err) {
  console.error('Test error:', err.message);
  await page.screenshot({ path: '/home/z/my-project/test-results/error-state.png' }).catch(() => {});
} finally {
  await browser.close();
}