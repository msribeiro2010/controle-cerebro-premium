const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const filePath = path.join(process.cwd(), 'src', 'renderer', 'index.html');
  await page.goto('file:///' + filePath.replace(/\\/g, '/'));
  await page.waitForTimeout(1000);
  await page.click('[data-tab="automation"]');
  await page.waitForTimeout(500);
  const rect = await page.evaluate(() => {
    const banner = document.querySelector('.automation-info-banner');
    if (!banner) return null;
    const r = banner.getBoundingClientRect();
    return {
      top: r.top,
      bottom: r.bottom,
      height: r.height,
      width: r.width
    };
  });
  console.log(JSON.stringify(rect, null, 2));
  await browser.close();
})();
