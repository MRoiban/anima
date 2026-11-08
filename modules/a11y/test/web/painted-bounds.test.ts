import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
const entries = ['index', 'a11y', 'a11y-actions', 'a11y-dom', 'a11y-bounds'];
const bundles = await Promise.all(
  entries.map((e) => cachedBundle(resolve('packages/web/src/' + e + '.ts'))),
);
for (const [name, engine, executablePath] of [
  [
    'Chromium',
    chromium,
    resolve(
      homedir(),
      '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
    ),
  ],
  ['Firefox', firefox, resolve(homedir(), '.cache/ms-playwright/firefox-1555/firefox/firefox')],
] as const)
  it.skipIf(!existsSync(executablePath))(
    `${name} overlay and headless geometric bounds include stroke and late registration`,
    async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent(
          '<anima-icon paused style="display:block;width:240px;height:240px"></anima-icon>',
        );
        for (const content of bundles.slice(0, -1))
          await page.addScriptTag({ type: 'module', content });
        await page.waitForFunction(
          () =>
            !!(customElements.get('anima-icon') as typeof AnimaIcon)?.modules.has('a11yactions'),
        );
        await page.evaluate(async () => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const loaded = new Promise<void>((r) =>
            icon.addEventListener('anima:load', () => r(), { once: true }),
          );
          icon.load({
            anima: '0.1',
            name: 'painted',
            grid: 20,
            requires: ['a11y'],
            nodes: [
              {
                id: 'n',
                type: 'circle',
                center: [5, 5],
                r: 2,
                stroke: { color: '#000', width: 2 },
                a11y: { role: 'button', label: 'Painted' },
              },
            ],
          });
          await loaded;
        });
        const before = await page.evaluate(
          () => (document.querySelector('anima-icon') as AnimaIcon).player!.semantics()[0]!.bounds,
        );
        expect(before).toEqual([3, 3, 4, 4]);
        await page.addScriptTag({ type: 'module', content: bundles.at(-1)! });
        await page.waitForFunction(
          () =>
            (document.querySelector('anima-icon') as AnimaIcon).player!.semantics()[0]!
              .bounds[0] === 2,
        );
        const result = await page.evaluate(async () => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          icon.invalidate();
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const el = icon.shadowRoot!.querySelector('[data-semantic="n"]') as HTMLElement;
          return {
            bounds: icon.player!.semantics()[0]!.bounds,
            style: [el.style.left, el.style.top, el.style.width, el.style.height],
          };
        });
        expect(result).toEqual({ bounds: [2, 2, 6, 6], style: ['2px', '2px', '6px', '6px'] });
      } finally {
        await browser.close();
      }
    },
    30000,
  );
