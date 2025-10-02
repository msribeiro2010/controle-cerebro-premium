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
    const styles = window.getComputedStyle(content);
    const children = Array.from(content.children).map(el => ({
      tag: el.tagName,
      classList: Array.from(el.classList),
      display: window.getComputedStyle(el).display,
      height: el.offsetHeight,
      visibility: window.getComputedStyle(el).visibility,
      opacity: window.getComputedStyle(el).opacity
    }));
    return {
      styles: {
        display: styles.display,
        height: styles.height,
        maxHeight: styles.maxHeight,
        overflow: styles.overflow,
        paddingTop: styles.paddingTop,
        marginTop: styles.marginTop
      },
      offsetHeight: content.offsetHeight,
      clientHeight: content.clientHeight,
      scrollHeight: content.scrollHeight,
      children
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
