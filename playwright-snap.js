const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const filePath = path.join(process.cwd(), 'src', 'renderer', 'index.html');
  await page.goto('file:///' + filePath.replace(/\\/g, '/'));
  await page.setViewportSize({ width: 1321, height: 768 });
  await page.waitForTimeout(2000);
  await page.click('[data-tab="automation"]');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(process.cwd(), 'automation-tab.png'), fullPage: true });
  await browser.close();
})();
