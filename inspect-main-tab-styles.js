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
      transform: styles.transform,
      position: styles.position,
      widthProp: styles.width,
      margin: styles.margin,
      padding: styles.padding,
      overflow: styles.overflow,
      float: styles.float
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
