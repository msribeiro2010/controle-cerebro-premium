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
  const info = await page.evaluate(() => {
    const automation = document.getElementById('automation');
    const styles = window.getComputedStyle(automation);
    return {
      classList: Array.from(automation.classList),
      display: styles.display,
      rect: automation.getBoundingClientRect(),
      visibility: styles.visibility
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
