const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const filePath = path.join(process.cwd(), 'src', 'renderer', 'index.html');
  await page.goto('file:///' + filePath.replace(/\\/g, '/'));
  await page.waitForTimeout(1000);
  const info = await page.evaluate(() => {
    const container = document.querySelector('.container');
    const styles = window.getComputedStyle(container);
    return {
      width: styles.width,
      display: styles.display,
      position: styles.position,
      rect: container.getBoundingClientRect()
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
