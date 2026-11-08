import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import console from 'node:console';
import { chromium, firefox } from 'playwright-core';
const results = [];
for (const [name, engine, binary] of [
  [
    'Chromium',
    chromium,
    'chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['Firefox', firefox, 'firefox-1555/firefox/firefox'],
]) {
  const browser = await engine.launch({
    executablePath: resolve(homedir(), '.cache/ms-playwright', binary),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    results.push({
      name,
      version: browser.version(),
      ...(await page.evaluate(() => {
        const ctx = globalThis.document.createElement('canvas').getContext('2d');
        return {
          fontVariationSettings: 'fontVariationSettings' in ctx,
          fontFeatureSettings: 'fontFeatureSettings' in ctx,
          fontKerning: 'fontKerning' in ctx,
        };
      })),
    });
  } finally {
    await browser.close();
  }
}
writeFileSync(
  'modules/text/verification/p7-6/canvas-api.json',
  JSON.stringify(results, null, 2) + '\n',
);
console.log(results);
