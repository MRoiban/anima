import '@anima-format/core/all';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { load, Player, toSVG } from '../../../../packages/core/src/index.ts';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
const doc = () => JSON.parse(readFileSync('examples/image-paints.ani', 'utf8'));
for (const [name, type, path] of [
  [
    'Chromium',
    chromium,
    resolve(
      homedir(),
      '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
    ),
  ],
  ['Firefox', firefox, resolve(homedir(), '.cache/ms-playwright/firefox-1555/firefox/firefox')],
] as const) {
  it(
    name + ' surface pixels: image, modulation, slices and independent feather',
    async () => {
      const executablePath = existsSync(path) ? path : type.executablePath();
      const browser = await type.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage({ deviceScaleFactor: 1 });
        page.setDefaultTimeout(5000);
        page.on('pageerror', (e) => console.error(e.message));
        await page.route('https://anima.test/**', (route) =>
          route.fulfill({ contentType: 'text/html', body: '<main></main>' }),
        );
        await page.goto('https://anima.test/');
        await page.setContent(
          '<style>body{margin:0;background:white}svg{display:block;width:240px;height:240px}</style><main></main>',
        );
        const render = async (d: object) => {
          const result = load(d);
          expect(result.diagnostics).toEqual([]);
          const svg = toSVG(new Player(result.model!));
          await page.locator('main').evaluate((el, svg) => {
            el.innerHTML = svg;
          }, svg);
          await page.waitForTimeout(80);
          const image = PNG.sync.read(await page.locator('main>svg').screenshot());
          return (x: number, y: number) => [
            ...image.data.slice(
              (Math.floor(y * 10) * image.width + Math.floor(x * 10)) * 4,
              (Math.floor(y * 10) * image.width + Math.floor(x * 10)) * 4 + 3,
            ),
          ];
        };
        let d = doc(),
          pixel = await render(d);
        expect(pixel(9, 10)).toEqual([255, 0, 0]);
        expect(pixel(13, 10)).toEqual([0, 0, 255]);
        d.nodes[0].fill.modulate = '#00ff00';
        pixel = await render(d);
        expect(pixel(9, 10)).toEqual([0, 0, 0]);
        expect(pixel(13, 10)).toEqual([0, 0, 0]);
        d = JSON.parse(readFileSync('spec/draw-conformance/surface-slice/case.ani', 'utf8'));
        pixel = await render(d);
        expect(pixel(5, 5)).toEqual([255, 0, 0]);
        expect(pixel(19, 5)).toEqual([0, 0, 255]);
        expect(pixel(12, 12)).toEqual([255, 255, 255]);
        expect(pixel(7, 5)).toEqual([255, 0, 0]);
        expect(pixel(9, 5)).toEqual([0, 0, 255]);
        expect(pixel(11, 5)).toEqual([255, 0, 0]);
        d = doc();
        d.nodes = [
          {
            id: 'group',
            type: 'group',
            slice: { x: [0, 2, 6, 8], y: [0, 2, 6, 8], width: 16, height: 16 },
            children: [
              { id: 'red', type: 'rect', x0: 0, y0: 0, w: 4, h: 8, fill: { color: '#ff0000' } },
              { id: 'blue', type: 'rect', x0: 4, y0: 0, w: 4, h: 8, fill: { color: '#0000ff' } },
            ],
          },
        ];
        pixel = await render(d);
        expect(pixel(1, 5)).toEqual([255, 0, 0]);
        expect(pixel(15, 5)).toEqual([0, 0, 255]);
        const children = d.nodes[0].children;
        d.requires.push('components');
        d.components = { panel: { grid: 8, nodes: children } };
        d.nodes = [
          {
            id: 'panel',
            type: 'instance',
            component: 'panel',
            slice: { x: [0, 2, 6, 8], y: [0, 2, 6, 8], width: 16, height: 16 },
          },
        ];
        pixel = await render(d);
        expect(pixel(1, 5)).toEqual([255, 0, 0]);
        expect(pixel(15, 5)).toEqual([0, 0, 255]);
        d = doc();
        d.nodes[0].fill = {
          color: '#ff0000',
          feather: { inner: 3, outer: 3, offset: [0, 0], enabled: true },
        };
        pixel = await render(d);
        expect(pixel(12, 12)).toEqual([255, 0, 0]);
        const edge = pixel(3, 12);
        expect(edge[0]).toBe(255);
        expect(edge[1]).toBeGreaterThan(180);
        expect(edge[1]).toBeLessThan(254);
        d.nodes[0].fill.feather.enabled = false;
        pixel = await render(d);
        expect(pixel(3, 12)).toEqual([255, 255, 255]);
        expect(pixel(4.1, 12)).toEqual([255, 0, 0]);
        d.nodes[0].fill.feather.enabled = true;
        d.nodes[0].stroke = { color: '#0000ff', width: 1 };
        pixel = await render(d);
        expect(pixel(4, 12)).toEqual([0, 0, 255]);
        // Retained runtime registration and image paints use the same backend as toSVG.
        await page.setContent(
          '<anima-icon style="display:block;width:240px;height:240px"></anima-icon>',
        );
        for (const entry of ['paint', 'assets', 'surface'])
          await page.addScriptTag({
            type: 'module',
            content: await bundle(resolve(`packages/web/src/${entry}.ts`)),
          });
        await page.evaluate(async (d) => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const done = new Promise<void>((r, reject) => {
            icon.addEventListener('anima:load', () => r(), { once: true });
            icon.addEventListener(
              'anima:error',
              (e) => reject(JSON.stringify((e as CustomEvent).detail)),
              { once: true },
            );
            setTimeout(() => reject('load event timed out'), 3000);
          });
          icon.load(d);
          await done;
        }, doc());
        const image = PNG.sync.read(await page.locator('anima-icon').screenshot());
        expect([
          ...image.data.slice((100 * image.width + 90) * 4, (100 * image.width + 90) * 4 + 3),
        ]).toEqual([255, 0, 0]);
        await page.evaluate(async (d) => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          icon.assets = () =>
            'data:image/svg+xml,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><path fill="#00ff00" d="M0 0h8v8H0z"/></svg>',
            );
          const done = new Promise<void>((resolve, reject) => {
            icon.addEventListener('anima:load', () => resolve(), { once: true });
            icon.addEventListener('anima:error', reject, { once: true });
          });
          icon.load(d);
          await done;
        }, doc());
        const replaced = PNG.sync.read(await page.locator('anima-icon').screenshot());
        expect([
          ...replaced.data.slice(
            (100 * replaced.width + 90) * 4,
            (100 * replaced.width + 90) * 4 + 3,
          ),
        ]).toEqual([0, 255, 0]);
      } finally {
        await browser.close();
      }
    },
    30000,
  );
}
