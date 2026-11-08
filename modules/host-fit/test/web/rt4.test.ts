import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
const engines = [
  [
    'Chromium',
    chromium,
    '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['Firefox', firefox, '.cache/ms-playwright/firefox-1555/firefox/firefox'],
] as const;
const entry = (name: string) => cachedBundle(resolve('packages/web/src/' + name + '.ts'));
async function withPage(
  engine: (typeof engines)[number][1],
  executable: string,
  run: (page: import('playwright-core').Page, errors: string[]) => Promise<void>,
) {
  const executablePath = [resolve(homedir(), executable), engine.executablePath()].find(existsSync);
  const browser = await engine.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await run(page, errors);
  } finally {
    await browser.close();
  }
}
// A separately bundled second copy of an entry: identical code, a distinct module script.
const again = async (page: import('playwright-core').Page, name: string) =>
  page.addScriptTag({ type: 'module', content: (await entry(name)) + '\n// second bundle' });
for (const [name, engine, executable] of engines)
  for (const order of [
    ['index', 'host-fit', 'host-fit'],
    ['index', 'host-fit-size', 'host-fit'],
  ])
    it(`${name}: R4-1 ${order.join(' → ')} installs once and shares explicit sizes`, async () => {
      await withPage(engine, executable, async (page, errors) => {
        await page.setContent(
          '<anima-icon style="display:block;width:240px;height:100px" paused></anima-icon>',
        );
        for (const [i, n] of order.entries())
          if (order.indexOf(n) === i)
            await page.addScriptTag({ type: 'module', content: await entry(n) });
          else await again(page, n);
        await page.waitForFunction(() => !!document.querySelector('anima-icon')!.resetSize);
        const box = await page.evaluate(() => {
          const i = document.querySelector('anima-icon') as AnimaIcon;
          i.load({
            anima: '0.1',
            name: 'fit',
            grid: 20,
            nodes: [{ id: 'r', type: 'rect', x0: 0, y0: 0, w: 4, h: 4 }],
          });
          i.size = [10, 5];
          i.fit = 'fill';
          return (i.constructor as typeof AnimaIcon).viewBox!(i);
        });
        expect(errors).toEqual([]);
        expect(box!.slice(2)).toEqual([10, 5]);
      });
    }, 30_000);
