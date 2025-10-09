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
    const tabContent = document.getElementById('servidores-automation');
    const styles = tabContent ? window.getComputedStyle(tabContent) : null;
    return {
      exists: !!tabContent,
      classList: tabContent ? Array.from(tabContent.classList) : [],
      display: styles ? styles.display : null,
      height: tabContent ? tabContent.offsetHeight : null,
      childCount: tabContent ? tabContent.children.length : null,
      firstChildTag: tabContent && tabContent.firstElementChild ? tabContent.firstElementChild.tagName : null,
      textSnippet: tabContent ? tabContent.textContent.trim().slice(0, 200) : null
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
