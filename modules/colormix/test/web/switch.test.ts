import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { beforeAll, expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';

const doc = JSON.parse(readFileSync(new URL('../../examples/switch.ani', import.meta.url), 'utf8'));
const cornerDoc = JSON.parse(
  readFileSync(new URL('../../../corners/examples/switch.ani', import.meta.url), 'utf8'),
);
let codes: string[];
beforeAll(async () => {
  codes = await Promise.all(
    ['index', 'corners', 'colormix', 'canvas', 'markup', 'markup-colormix', 'markup-animation'].map(
      (n) => cachedBundle(resolve('packages/web/src/' + n + '.ts')),
    ),
  );
}, 120000);
for (const [name, type, path] of [
  [
    'Chromium',
    chromium,
    '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['Firefox', firefox, '.cache/ms-playwright/firefox-1555/firefox/firefox'],
] as const) {
  it(
    name + ' mixes a single track in SVG and canvas, keeping page slots live',
    async () => {
      const browser = await type.launch({
        headless: true,
        executablePath: resolve(homedir(), path),
      });
      try {
        const page = await browser.newPage({
          viewport: { width: 440, height: 240 },
          deviceScaleFactor: 1,
        });
        page.setDefaultTimeout(5000);
        await page.setContent(
          '<style>body{margin:0;background:white}anima-icon{display:inline-block;width:200px;height:200px}</style><anima-icon id="svg" paused></anima-icon><anima-icon id="canvas" paused renderer="canvas" pixel-ratio="1"></anima-icon>',
        );
        await page.addScriptTag({ type: 'module', content: codes[0]! });
        if (process.env.PAINT_PROOF) console.log(name + ' base loaded');
        const before = await page.evaluate(
          async ({ doc, cornerDoc }) => {
            const icon = document.querySelector('#svg') as AnimaIcon;
            const out = [];
            for (const d of [doc, cornerDoc]) {
              try {
                out.push(icon.load(d));
              } catch (e) {
                out.push(e);
              }
            }
            return out;
          },
          { doc, cornerDoc },
        );
        expect(JSON.stringify(before)).toContain('unknown-feature');
        if (name === 'Chromium' && process.env.PAINT_PROOF) {
          console.log(name + ' capture before');
          const png = await page.screenshot({
            clip: { x: 0, y: 0, width: 200, height: 200 },
            animations: 'disabled',
          });
          for (const n of [26, 30]) writeFileSync(`design/issues/proof/${n}-before.png`, png);
        }
        // Separate bundles share the active registry. Also exercises canvas loaded after colormix.
        for (const code of codes.slice(1))
          await page.addScriptTag({ type: 'module', content: code });
        if (process.env.PAINT_PROOF) console.log(name + ' modules loaded');
        const samples = [];
        for (const theme of ['', '--anima-off:#ff0000;--anima-on:#0000ff']) {
          await page.evaluate(
            async ({ doc, theme }) => {
              for (const icon of document.querySelectorAll<AnimaIcon>('anima-icon')) {
                icon.style.cssText = 'width:200px;height:200px;' + theme;
                icon.load(doc);
                await icon.ready;
              }
            },
            { doc, theme },
          );
          for (const dt of [0, 0.5, 0.5]) {
            const got = await page.evaluate((dt) => {
              const icons = [...document.querySelectorAll<AnimaIcon>('anima-icon')];
              for (const icon of icons) {
                icon.player!.step(dt);
                icon.invalidate();
              }
              const path = icons[0]!.shadowRoot!.querySelector('rect')!;
              const canvas = icons[1]!.shadowRoot!.querySelector('canvas')!;
              const pixel = [...canvas.getContext('2d')!.getImageData(100, 100, 1, 1).data];
              const reference = document.createElement('canvas');
              reference.width = reference.height = 1;
              const ctx = reference.getContext('2d')!;
              const computed = getComputedStyle(path).fill;
              ctx.fillStyle = computed;
              ctx.fillRect(0, 0, 1, 1);
              return {
                weight: icons[0]!.player!.value('track.fill.mix.t'),
                computed,
                svg: path.getAttribute('fill'),
                pixel,
                oracle: [...ctx.getImageData(0, 0, 1, 1).data],
                nodes: icons[0]!.player!.model.nodes.length,
              };
            }, dt);
            expect(got.nodes).toBe(1);
            expect(got.svg).toContain(
              'color-mix(in srgb, var(--anima-off, #000), var(--anima-on, #fff)',
            );
            const t = got.weight as number;
            const want = theme
              ? [Math.round(255 * (1 - t)), 0, Math.round(255 * t), 255]
              : [Math.round(255 * t), Math.round(255 * t), Math.round(255 * t), 255];
            expect(got.pixel).toEqual(want);
            expect(got.oracle).toEqual(want);
            samples.push({ theme, ...got });
          }
        }
        // Transparent interpolation must be premultiplied; hidden red cannot bleed into blue.
        const transparent = structuredClone(doc);
        transparent.colors = { off: '#ff000000', on: '#0000ff' };
        await page.evaluate(async (d) => {
          for (const icon of document.querySelectorAll<AnimaIcon>('anima-icon')) {
            icon.style.cssText = 'width:200px;height:200px';
            icon.load(d);
            await icon.ready;
            icon.player!.step(0.5);
            icon.invalidate();
          }
        }, transparent);
        expect(
          await page
            .locator('#canvas')
            .evaluate((el) => [
              ...el
                .shadowRoot!.querySelector('canvas')!
                .getContext('2d')!
                .getImageData(100, 100, 1, 1).data,
            ]),
        ).toEqual([0, 0, 255, 128]);
        if (name === 'Chromium' && process.env.PAINT_PROOF) {
          writeFileSync(
            'design/issues/proof/26-colours.json',
            JSON.stringify({ before, samples, transparent: [0, 0, 255, 128] }, null, 2) + '\n',
          );
          await page.screenshot({
            path: 'design/issues/proof/26-after.png',
            clip: { x: 0, y: 45, width: 400, height: 110 },
          });
        }
        await page.locator('#svg').evaluate(async (el, d) => {
          const icon = el as AnimaIcon;
          icon.load(d);
          await icon.ready;
          icon.invalidate();
        }, cornerDoc);
        expect(
          await page
            .locator('#svg')
            .evaluate((el) => el.shadowRoot!.querySelector('path')!.getAttribute('d')),
        ).toMatch(/^M/);
        if (name === 'Chromium' && process.env.PAINT_PROOF)
          await page.screenshot({
            path: 'design/issues/proof/30-after.png',
            clip: { x: 0, y: 0, width: 200, height: 200 },
            animations: 'disabled',
          });
        // Descriptor syntax compiles with only its optional authoring add-on.
        await page.locator('#svg').evaluate(
          async (el, source) => {
            const icon = el as AnimaIcon;
            icon.load(source);
            await icon.ready;
          },
          readFileSync(new URL('../../examples/switch.animl', import.meta.url), 'utf8'),
        );
      } finally {
        await browser.close();
      }
    },
    30000,
  );
}
