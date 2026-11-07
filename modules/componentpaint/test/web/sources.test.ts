import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser } from 'playwright-core';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
const doc = JSON.parse(readFileSync('modules/componentpaint/examples/live.ani', 'utf8'));
for (const [name, engine, cache] of [
  [
    'Chromium',
    chromium,
    '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['Firefox', firefox, '.cache/ms-playwright/firefox-1555/firefox/firefox'],
] as const)
  describe(name + ' optional component paint', () => {
    let browser: Browser;
    const bundles = new Map<string, string>();
    beforeAll(async () => {
      await Promise.all(
        [
          'index',
          'paint',
          'components',
          'componentpaint',
          'canvas',
          'nested',
          'bind',
          'data',
          'markup',
        ].map(async (n) => bundles.set(n, await bundle(resolve(`packages/web/src/${n}.ts`)))),
      );
      const executablePath = [resolve(homedir(), cache), engine.executablePath()].find(existsSync);
      if (!executablePath) throw Error('browser absent');
      browser = await engine.launch({ executablePath, headless: true });
    });
    afterAll(async () => {
      await browser?.close();
    });
    for (const order of [
      ['index', 'components', 'paint', 'canvas', 'componentpaint'],
      ['index', 'componentpaint', 'canvas', 'paint', 'components'],
    ])
      it(
        'isolates live sources and replays across separate bundles: ' + order.join(','),
        async () => {
          const page = await browser.newPage();
          try {
            await page.setContent(
              '<anima-icon paused style="width:200px;height:200px;display:block"></anima-icon>',
            );
            for (const n of order)
              await page.addScriptTag({ type: 'module', content: bundles.get(n)! });
            await page.waitForFunction(
              () =>
                ['components', 'paint', 'componentpaint'].every((n) =>
                  (customElements.get('anima-icon') as typeof AnimaIcon)?.modules.has(n),
                ),
              {},
              { polling: 10 },
            );
            await page.evaluate((doc) => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              const errors = icon.load(doc);
              if (errors.length) throw Error(JSON.stringify(errors));
              icon.player!.step(0.5);
              icon.invalidate();
            }, doc);
            expect(
              await page.evaluate(() => {
                const icon = document.querySelector('anima-icon') as AnimaIcon;
                return [
                  ...icon.shadowRoot!.querySelector('pattern svg')!.querySelectorAll('g'),
                ].map((e) => e.getAttribute('transform'));
              }),
            ).toEqual(['matrix(1 0 0 1 0 0)', 'matrix(1 0 0 1 3 0)']);
            await page.evaluate(() => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              icon.setAttribute('renderer', 'canvas');
              icon.invalidate();
            });
            const pixels = await page.evaluate(() => {
              const canvas = document
                .querySelector('anima-icon')!
                .shadowRoot!.querySelector('canvas')!;
              const ctx = canvas.getContext('2d')!;
              return [5, 15, 35].map((x) => [...ctx.getImageData(x, 5, 1, 1).data]);
            });
            expect(pixels).toEqual([
              [32, 64, 128, 255],
              [224, 128, 32, 255],
              [32, 64, 128, 255],
            ]);
            await page.evaluate(() => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              const Child = icon.player!
                .constructor as typeof import('../../../../packages/core/src/player.ts').Player;
              icon.player = new Child(icon.player!.model);
              icon.player.step(1);
              icon.invalidate();
              icon.setAttribute('renderer', 'svg');
            });
            expect(
              await page.evaluate(() => {
                const icon = document.querySelector('anima-icon') as AnimaIcon;
                return icon.values()['tile/paint/bar.x'];
              }),
            ).toBe(6);
          } finally {
            await page.close();
          }
        },
      );
    it('rebuilds a dynamic source tree without advancing playback when switching renderers', async () => {
      const page = await browser.newPage();
      try {
        await page.setContent(
          '<anima-icon paused style="width:200px;height:200px;display:block"></anima-icon>',
        );
        for (const n of [
          'index',
          'components',
          'paint',
          'data',
          'bind',
          'nested',
          'canvas',
          'componentpaint',
        ])
          await page.addScriptTag({ type: 'module', content: bundles.get(n)! });
        await page.waitForFunction(
          () =>
            ['nested', 'data', 'componentpaint'].every((n) =>
              (customElements.get('anima-icon') as typeof AnimaIcon)?.modules.has(n),
            ),
          {},
          { polling: 10 },
        );
        const source = {
          anima: '0.1',
          name: 'nested-paint',
          grid: 20,
          requires: ['components', 'paint', 'componentpaint', 'nested'],
          components: {
            row: { grid: 10, nodes: [{ id: 'nested', type: 'instance', component: 'leaf' }] },
            leaf: {
              grid: 10,
              nodes: [
                {
                  id: 'leaf',
                  type: 'rect',
                  x0: 0,
                  y0: 0,
                  w: 10,
                  h: 10,
                  fill: { color: '#ff0000' },
                },
              ],
            },
          },
          nodes: [
            {
              id: 'painted',
              type: 'rect',
              x0: 0,
              y0: 0,
              w: 20,
              h: 20,
              fill: { paint: 'component:row' },
            },
          ],
        };
        await page.evaluate((doc) => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const d = icon.load(doc);
          if (d.length) throw Error(JSON.stringify(d));
          icon.player!.step(0);
          icon.invalidate();
        }, source);
        expect(
          await page.locator('anima-icon').locator('pattern rect').count(),
          await page.evaluate(() => document.querySelector('anima-icon')!.shadowRoot!.innerHTML),
        ).toBe(1);
        await page.evaluate(() => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          icon.setAttribute('renderer', 'canvas');
        });
        expect(
          await page.evaluate(() => [
            ...document
              .querySelector('anima-icon')!
              .shadowRoot!.querySelector('canvas')!
              .getContext('2d')!
              .getImageData(5, 5, 1, 1).data,
          ]),
        ).toEqual([255, 0, 0, 255]);
      } finally {
        await page.close();
      }
    });
    it('reports source backend limits at each consuming paint pointer', async () => {
      const page = await browser.newPage();
      try {
        await page.setContent(
          '<anima-icon paused renderer="canvas" style="width:200px;height:200px;display:block"></anima-icon>',
        );
        for (const n of ['index', 'components', 'paint', 'canvas', 'componentpaint'])
          await page.addScriptTag({ type: 'module', content: bundles.get(n)! });
        await page.waitForFunction(
          () =>
            ['componentpaint', 'components', 'paint'].every((n) =>
              (customElements.get('anima-icon') as typeof AnimaIcon)?.modules.has(n),
            ),
          {},
          { polling: 10 },
        );
        const result = await page.evaluate(() => {
          const errors: unknown[] = [];
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          icon.addEventListener('anima:error', (e) => errors.push(...(e as CustomEvent).detail));
          icon.load({
            anima: '0.1',
            name: 'source-limit',
            grid: 20,
            requires: ['components', 'paint', 'componentpaint'],
            components: {
              row: {
                grid: 10,
                nodes: [
                  {
                    id: 'line',
                    type: 'path',
                    d: 'M0 5L10 5',
                    stroke: { color: '#000', width: 2, scale: 'fixed', trimEnd: 0.5 },
                  },
                ],
              },
            },
            nodes: [
              {
                id: 'first',
                type: 'rect',
                x0: 0,
                y0: 0,
                w: 10,
                h: 10,
                fill: { paint: 'component:row' },
              },
              {
                id: 'second',
                type: 'rect',
                x0: 10,
                y0: 0,
                w: 10,
                h: 10,
                fill: { paint: 'component:row' },
              },
            ],
          });
          return errors;
        });
        expect(result).toEqual([
          expect.objectContaining({
            code: 'unsupported-render',
            pointer: '/nodes/0/fill/paint',
            message: expect.stringContaining('fixed stroke trim'),
            hint: expect.any(String),
          }),
          expect.objectContaining({
            code: 'unsupported-render',
            pointer: '/nodes/1/fill/paint',
            message: expect.stringContaining('fixed stroke trim'),
            hint: expect.any(String),
          }),
        ]);
      } finally {
        await page.close();
      }
    });
    it('compiles live AniML sources through the separately bundled markup registry', async () => {
      const page = await browser.newPage();
      try {
        await page.setContent(
          '<anima-icon paused style="display:block;width:200px;height:200px"></anima-icon>',
        );
        for (const n of ['index', 'componentpaint', 'components', 'paint', 'markup'])
          await page.addScriptTag({ type: 'module', content: bundles.get(n)! });
        await page.waitForFunction(
          () => !!(customElements.get('anima-icon') as typeof AnimaIcon)?.compiler,
          {},
          { polling: 10 },
        );
        const result = await page.evaluate(
          (xml) => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            const diagnostics = icon.load(xml, true);
            if (diagnostics.length) return { diagnostics };
            icon.player!.step(0.5);
            icon.invalidate();
            return {
              diagnostics,
              paint: icon.player!.model.doc.nodes[0].fill.paint,
              value: icon.values()['tile/paint/bar.x'],
              pattern: !!icon.shadowRoot!.querySelector('pattern'),
            };
          },
          readFileSync('modules/componentpaint/examples/live.animl', 'utf8'),
        );
        expect(result).toEqual({
          diagnostics: [],
          paint: 'component:row',
          value: 3,
          pattern: true,
        });
      } finally {
        await page.close();
      }
    });
    it('preserves base empty-fill validation when the paint module has not been loaded', async () => {
      const page = await browser.newPage();
      try {
        await page.setContent('<anima-icon paused></anima-icon>');
        for (const n of ['index', 'componentpaint'])
          await page.addScriptTag({ type: 'module', content: bundles.get(n)! });
        await page.waitForFunction(
          () =>
            (customElements.get('anima-icon') as typeof AnimaIcon)?.modules.has('componentpaint'),
          {},
          { polling: 10 },
        );
        const diagnostics = await page.evaluate(() =>
          (document.querySelector('anima-icon') as AnimaIcon).load({
            anima: '0.1',
            name: 'empty-fill',
            grid: 20,
            nodes: [{ id: 'rect', type: 'rect', x0: 0, y0: 0, w: 10, h: 10, fill: {} }],
          }),
        );
        expect(diagnostics).toContainEqual(
          expect.objectContaining({
            code: 'missing-key',
            pointer: '/nodes/0/fill',
            message: expect.any(String),
          }),
        );
      } finally {
        await page.close();
      }
    });
  });
