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
    const content = document.getElementById('servidores-automation');
    if (!content) return null;
    const rect = content.getBoundingClientRect();
    const controls = content.querySelector('.automation-controls');
    return {
      tabRect: { width: rect.width, height: rect.height },
      controlsRect: controls ? controls.getBoundingClientRect() : null,
      controlsStyles: controls ? {
        display: window.getComputedStyle(controls).display,
        width: window.getComputedStyle(controls).width,
        flex: window.getComputedStyle(controls).flex,
        alignItems: window.getComputedStyle(controls).alignItems
      } : null
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
