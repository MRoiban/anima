import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import { testFont } from '../../../../tools/test-font.ts';
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
for (const [name, engine, executable] of engines)
  it(`${name}: R5-2 a static hug layout re-resolves when its font becomes ready`, async () => {
    await withPage(engine, executable, async (page, errors) => {
      await page.setContent('<anima-icon style="width:200px;height:200px"></anima-icon>');
      for (const n of ['index', 'text', 'assets', 'fonts-text', 'layout'])
        await page.addScriptTag({ type: 'module', content: await entry(n) });
      await page.waitForFunction(
        () => !!(customElements.get('anima-icon') as typeof AnimaIcon)?.modules.get('layout'),
      );
      await page.evaluate(async (base64) => {
        const i = document.querySelector('anima-icon') as AnimaIcon;
        i.load({
          anima: '0.1',
          name: 'font-layout',
          grid: 20,
          requires: ['layout', 'text', 'fonts', 'assets'],
          assets: { body: { type: 'font', source: 'data:font/ttf;base64,' + base64 } },
          nodes: [
            {
              type: 'layout',
              id: 'row',
              padding: 1,
              children: [
                {
                  type: 'text',
                  id: 'label',
                  runs: [{ style: 's', text: 'AB' }],
                  styles: { s: { size: 2, font: 'body', fill: { color: '#000' } } },
                },
              ],
            },
          ],
        });
        await i.ready;
      }, testFont().toString('base64'));
      // No step after load: the box must follow the font's measurement on its own.
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const p = document.querySelector('anima-icon')!.player!;
              return p.layoutBox('label')!.width > 0 && p.layoutBox('row')!.width;
            }),
          { timeout: 10_000 },
        )
        .toBeGreaterThan(2);
      expect(errors).toEqual([]);
    });
  }, 30_000);
