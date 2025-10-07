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
    const controls = document.querySelector('#servidores-automation .automation-controls');
    if (!controls) return null;
    const children = Array.from(controls.children).map(el => ({
      tag: el.tagName,
      classList: Array.from(el.classList),
      display: window.getComputedStyle(el).display,
      height: el.offsetHeight,
      flex: window.getComputedStyle(el).flex,
      position: window.getComputedStyle(el).position
    }));
    return {
      display: window.getComputedStyle(controls).display,
      flexDirection: window.getComputedStyle(controls).flexDirection,
      height: controls.offsetHeight,
      childCount: controls.children.length,
      children
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
