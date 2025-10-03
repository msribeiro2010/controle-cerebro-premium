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
  const html = await page.evaluate(() => document.getElementById('automation').outerHTML);
  console.log(html);
  await browser.close();
})();
