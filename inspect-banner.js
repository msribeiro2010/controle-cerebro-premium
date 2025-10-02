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
    const banner = document.querySelector('.automation-info-banner');
    if (!banner) return null;
    const styles = window.getComputedStyle(banner);
    return {
      display: styles.display,
      fontSize: styles.fontSize,
      padding: styles.padding,
      height: banner.offsetHeight,
      scrollHeight: banner.scrollHeight,
      border: styles.border,
      visibility: styles.visibility,
      opacity: styles.opacity,
      transform: styles.transform
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
