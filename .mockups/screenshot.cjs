// Renders each concept at desktop (1440x900) and mobile (390x844) into screenshots/.
// Usage: node screenshot.cjs [a b c ...]   (Playwright + Chromium; fonts come from Google Fonts)
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const DIR = __dirname;
const concepts = process.argv.slice(2).length ? process.argv.slice(2) : ['a', 'b', 'c', 'd', 'e'];
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy });
  for (const c of concepts) {
    for (const [kind, viewport, dpr] of [['desktop', { width: 1440, height: 900 }, 1], ['mobile', { width: 390, height: 844 }, 2]]) {
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, ignoreHTTPSErrors: true });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('file://' + path.join(DIR, `concept-${c}.html`), { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')));
      await page.screenshot({ path: path.join(DIR, 'screenshots', `concept-${c}-${kind}.png`) });
      if (kind === 'mobile') await page.screenshot({ path: path.join(DIR, 'screenshots', `concept-${c}-mobile-full.png`), fullPage: true });
      console.log(`concept-${c}-${kind}: overflow ${overflow}px, fonts [${[...new Set(fonts)].join(', ')}]${errors.length ? ', errors ' + errors : ''}`);
      await ctx.close();
    }
  }
  await browser.close();
})();
