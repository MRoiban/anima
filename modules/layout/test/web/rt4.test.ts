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
  it(`${name}: R4-5 a second layout-reflow bundle keeps in-flight reflows settling`, async () => {
    await withPage(engine, executable, async (page, errors) => {
      await page.setContent('<anima-icon paused motion="full"></anima-icon>');
      for (const n of ['index', 'bind', 'layout-reflow'])
        await page.addScriptTag({ type: 'module', content: await entry(n) });
      await page.waitForFunction(() => !!document.querySelector('anima-icon')!.load);
      expect(
        await page.evaluate(() => {
          const i = document.querySelector('anima-icon') as AnimaIcon;
          i.load({
            anima: '0.1',
            name: 'reflow',
            grid: 100,
            requires: ['layout', 'bind'],
            inputs: { width: { type: 'number', default: 10 } },
            bind: { 'a.layout.width': 'width' },
            nodes: [
              {
                id: 'row',
                type: 'layout',
                width: 100,
                height: 20,
                reflow: 1,
                children: [{ id: 'a', type: 'rect', x0: 0, y0: 0, w: 10, h: 10 }],
              },
            ],
          });
          const p = i.player!;
          p.set('width', 40);
          p.step(0);
          p.step(0.25);
          return p.busy;
        }),
      ).toBe(true);
      await again(page, 'layout-reflow');
      const after = await page.evaluate(() => {
        const p = document.querySelector('anima-icon')!.player!;
        const step = p.step(2);
        return { settled: step.settled, busy: p.busy, width: p.drawnLayoutBox('a')!.width };
      });
      expect(errors).toEqual([]);
      expect(after).toEqual({ settled: true, busy: false, width: 40 });
    });
  }, 30_000);
