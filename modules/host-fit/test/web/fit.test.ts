import { existsSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type { HostLayoutPlayer } from '../../web/index.ts';
import type {} from '../../../input/web/index.ts';
import type {} from '../../../a11y-dom/web/index.ts';
import type {} from '../../../canvas/web/index.ts';
const root = new URL('../../../../', import.meta.url);
const scene = {
  anima: '0.1',
  name: 'host-fit',
  grid: 20,
  viewBox: [-2, -1, 24, 12],
  requires: ['input', 'a11y'],
  inputs: { down: { type: 'bool' } },
  nodes: [
    {
      id: 'tile',
      type: 'rect',
      x0: 3,
      y0: 2,
      w: 4,
      h: 3,
      fill: { color: '#4263eb' },
      a11y: { role: 'button', label: 'Tile', bounds: [3, 2, 4, 3] },
    },
  ],
  listeners: [{ on: 'down', target: 'tile', set: { down: true } }],
};
// Independent vectors: host 240x100, artboard 24x12 with origin (-2,-1).
const cases: [string, number, number, number, number][] = [
  ['contain', 25 / 3, 25 / 3, 110 / 3, 25 / 3],
  ['cover', 10, 10, 20, 0],
  ['fill', 10, 25 / 3, 20, 25 / 3],
  ['fit-width', 10, 10, 20, 0],
  ['fit-height', 25 / 3, 25 / 3, 110 / 3, 25 / 3],
  ['none', 1, 1, 110, 45],
  ['scale-down', 1, 1, 110, 45],
  ['layout', 1, 1, 2, 1],
];
for (const [engineName, engine, executablePath] of [
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
  describe.skipIf(!existsSync(executablePath))(`host fit ${engineName}`, () => {
    let browser: Browser, page: Page;
    let bundles: string[];
    beforeAll(async () => {
      bundles = await Promise.all(
        ['index', 'input', 'a11y-dom', 'canvas', 'host-fit', 'layout'].map((n) =>
          cachedBundle(new URL(`packages/web/src/${n}.ts`, root).pathname),
        ),
      );
      browser = await engine.launch({
        executablePath,
        headless: true,
        args: engineName === 'Chromium' ? ['--no-sandbox'] : [],
      });
    }, 60000);
    afterAll(async () => {
      await browser?.close();
    });
    beforeEach(async () => {
      page = await browser.newPage();
      await page.setContent(
        '<anima-icon style="display:block;width:240px;height:100px" paused></anima-icon>',
      );
      for (const content of bundles) await page.addScriptTag({ type: 'module', content });
      await page.waitForFunction(() => !!document.querySelector('anima-icon')!.resetSize);
      expect(
        await page.evaluate((d) => document.querySelector('anima-icon')!.load(d), scene),
      ).toEqual([]);
      await page.evaluate(() => new Promise(requestAnimationFrame));
    });
    afterEach(async () => {
      await page?.close();
    });
    for (const renderer of ['svg', 'canvas']) {
      it(`${renderer}: R1-2/R1-4/R1-5 layout drawing, hits and semantic overlay stay aligned`, async () => {
        await page.evaluate((renderer) => {
          const i = document.querySelector('anima-icon')!;
          i.setAttribute('renderer', renderer);
          i.fit = 'layout';
          const errors = i.load({
            anima: '0.1',
            name: 'layout-semantic',
            grid: 100,
            requires: ['layout', 'input', 'a11y'],
            inputs: { down: { type: 'bool' } },
            nodes: [
              {
                id: 'root',
                type: 'layout',
                width: 100,
                height: 100,
                children: [
                  {
                    id: 'dot',
                    type: 'circle',
                    center: [50, 50],
                    r: 5,
                    fill: { color: '#000' },
                    a11y: { role: 'button', label: 'Dot' },
                  },
                  {
                    id: 'tile',
                    type: 'rect',
                    x0: 10,
                    y0: 10,
                    w: 2,
                    h: 2,
                    layout: { width: 'fill', height: 'fill' },
                    fill: { color: '#f00' },
                    a11y: { role: 'button', label: 'Tile' },
                  },
                ],
              },
            ],
            listeners: [{ on: 'down', target: 'tile', set: { down: true } }],
          });
          if (errors.some((d) => d.severity === 'error')) throw Error(JSON.stringify(errors));
        }, renderer);
        const check = async (width: number) => {
          await expect
            .poll(() =>
              page.evaluate(() => {
                const i = document.querySelector('anima-icon')!,
                  r = i.getBoundingClientRect();
                const b = i
                  .shadowRoot!.querySelector('[data-semantic="tile"]')
                  ?.getBoundingClientRect();
                return (
                  b &&
                  [b.x - r.x, b.y - r.y, b.width, b.height].map((n) => Math.round(n * 100) / 100)
                );
              }),
            )
            .toEqual([10, 0, width - 10, 100]);
          expect(
            await page.evaluate(
              () => document.querySelector('anima-icon')!.player!.semantics()[0]!.bounds,
            ),
          ).toEqual([0, 0, 10, 10]);
        };
        await check(240);
        await page.evaluate(() => {
          const i = document.querySelector('anima-icon')!,
            r = i.getBoundingClientRect();
          i.dispatchEvent(
            new PointerEvent('pointerdown', {
              clientX: r.x + 25,
              clientY: r.y + 10,
              button: 0,
              pointerId: 1,
              bubbles: true,
            }),
          );
          i.player!.step(0);
        });
        expect(await page.evaluate(() => document.querySelector('anima-icon')!.get('down'))).toBe(
          true,
        );
        await page.evaluate(() => {
          document.querySelector('anima-icon')!.style.width = '180px';
        });
        await check(180);
      }, 30_000);

      it(`${renderer}: R1-7 fits and lays out the content box for either box sizing`, async () => {
        for (const sizing of ['border-box', 'content-box']) {
          const result = await page.evaluate(
            ({ renderer, sizing }) => {
              const i = document.querySelector('anima-icon')!;
              i.setAttribute('renderer', renderer);
              i.style.cssText = `display:block;box-sizing:${sizing};width:200px;height:100px;border:10px solid;padding:5px`;
              i.fit = 'layout';
              const layoutSize = i.player!.layoutSize;
              i.fit = 'contain';
              const box = (i.constructor as typeof AnimaIcon).viewBox!(i);
              return { layoutSize, box };
            },
            { renderer, sizing },
          );
          const w = sizing === 'border-box' ? 170 : 200;
          const h = sizing === 'border-box' ? 70 : 100;
          expect(result.layoutSize).toEqual([w, h]);
          expect(result.box![2]).toBeCloseTo(w / Math.min(w / 24, h / 12), 5);
          expect(result.box![3]).toBeCloseTo(h / Math.min(w / 24, h / 12), 5);
        }
      }, 30_000);

      it.each(cases)(
        `${renderer}: %s shares drawing, pointer and semantic matrices`,
        async (fit, sx, sy, tx, ty) => {
          await page.evaluate(
            ({ renderer, fit }) => {
              const i = document.querySelector('anima-icon')!;
              i.setAttribute('renderer', renderer);
              i.fit = fit;
            },
            { renderer, fit },
          );
          await page.evaluate(() => new Promise(requestAnimationFrame));
          const result = await page.evaluate(
            ([sx, sy, tx, ty]) => {
              const i = document.querySelector('anima-icon')!,
                b = i.getBoundingClientRect();
              const x = b.x + 5 * sx + tx,
                y = b.y + 3.5 * sy + ty;
              const point = i.inputPoint(x, y);
              const bounds = i
                .shadowRoot!.querySelector('[data-semantic="tile"]')!
                .getBoundingClientRect();
              const svg = i.shadowRoot!.querySelector('svg');
              const c = (i.constructor as typeof AnimaIcon).canvasBox?.(i, [0, 0, 1, 1]);
              const matrix = svg?.getScreenCTM();
              i.dispatchEvent(
                new PointerEvent('pointerdown', {
                  clientX: x,
                  clientY: y,
                  button: 0,
                  pointerId: 1,
                  bubbles: true,
                }),
              );
              i.player!.step(0);
              return {
                point: [point.x, point.y],
                down: i.get('down'),
                bounds: [bounds.x - b.x, bounds.y - b.y, bounds.width, bounds.height],
                matrix: matrix
                  ? [matrix.a, matrix.d, matrix.e - b.x, matrix.f - b.y]
                  : [c!.width, c!.height, c!.x - b.x, c!.y - b.y],
              };
            },
            [sx, sy, tx, ty],
          );
          result.matrix.forEach((n, j) => expect(n).toBeCloseTo([sx, sy, tx, ty][j]!, 4));
          result.bounds.forEach((n, j) =>
            expect(n).toBeCloseTo([3 * sx + tx, 2 * sy + ty, 4 * sx, 3 * sy][j]!, 1),
          );
          expect(result.point[0]).toBeCloseTo(5, 4);
          expect(result.point[1]).toBeCloseTo(3.5, 4);
          expect(result.down).toBe(true);
        },
      );
      it(`${renderer}: pointer inversion follows the currently drawn matrix before resize delivery`, async () => {
        const point = await page.evaluate((renderer) => {
          const i = document.querySelector('anima-icon')!;
          i.setAttribute('renderer', renderer);
          i.fit = 'none';
          i.style.width = '120px';
          const c = (i.constructor as typeof AnimaIcon).canvasBox?.(i, [0, 0, 1, 1]);
          const m = c
            ? new DOMMatrix([c.width, 0, 0, c.height, c.x, c.y])
            : i.shadowRoot!.querySelector('svg')!.getScreenCTM()!;
          const screen = new DOMPoint(5, 3.5).matrixTransform(m);
          const p = i.inputPoint(screen.x, screen.y);
          return [p.x, p.y];
        }, renderer);
        expect(point[0]).toBeCloseTo(5, 4);
        expect(point[1]).toBeCloseTo(3.5, 4);
      });
      it(`${renderer}: all eight fits match independent native captures at 240x120`, async () => {
        for (const [fit] of cases) {
          await page.evaluate(
            ({ renderer, fit }) => {
              document.body.style.cssText = 'margin:0;background:#1d1d1d';
              const i = document.querySelector('anima-icon')!;
              i.style.height = '120px';
              i.setAttribute('renderer', renderer);
              i.fit = fit;
              i.load({
                anima: '0.1',
                name: 'native-fit',
                grid: 24,
                viewBox: [0, 0, 24, 10],
                nodes: [
                  {
                    id: 'tile',
                    type: 'rect',
                    x0: 3,
                    y0: 2,
                    w: 4,
                    h: 4,
                    fill: { color: '#4263eb' },
                  },
                ],
              });
            },
            { renderer, fit },
          );
          await page.evaluate(
            () =>
              new Promise<void>((r) =>
                requestAnimationFrame(() => requestAnimationFrame(() => r())),
              ),
          );
          const actual = PNG.sync.read(await page.locator('anima-icon').screenshot());
          const expected = PNG.sync.read(
            readFileSync(new URL(`../../verification/native/frames/${fit}.png`, import.meta.url)),
          );
          expect([actual.width, actual.height]).toEqual([240, 120]);
          let max = 0,
            pixels = 0;
          for (let p = 0; p < actual.data.length; p += 4) {
            let diff = 0;
            for (let c = 0; c < 4; c++)
              diff = Math.max(diff, Math.abs(actual.data[p + c]! - expected.data[p + c]!));
            max = Math.max(max, diff);
            if (diff > 2) pixels++;
          }
          expect({ max, pixels }, fit).toEqual({ max: expect.any(Number), pixels: 0 });
          expect(max, fit).toBeLessThanOrEqual(2);
        }
      });
      it(`${renderer}: responsive child bounds and every pixel match native layout fit at two sizes`, async () => {
        await page.evaluate((renderer) => {
          document.body.style.cssText = 'margin:0;background:white';
          const i = document.querySelector('anima-icon')!;
          i.setAttribute('renderer', renderer);
          i.fit = 'layout';
          i.load({
            anima: '0.1',
            name: 'responsive-native',
            grid: 20,
            requires: ['layout'],
            nodes: [
              {
                id: 'root',
                type: 'layout',
                width: 24,
                height: 12,
                padding: 2,
                fill: { color: '#fff' },
                children: [
                  {
                    id: 'child',
                    type: 'rect',
                    x0: 0,
                    y0: 0,
                    w: 1,
                    h: 1,
                    layout: { width: 'fill', height: 'fill' },
                    fill: { color: '#f00' },
                  },
                ],
              },
            ],
          });
        }, renderer);
        for (const [w, h] of [
          [240, 100],
          [160, 80],
        ]) {
          await page.evaluate(
            ([w, h]) => {
              const i = document.querySelector('anima-icon')!;
              i.style.width = w + 'px';
              i.style.height = h + 'px';
            },
            [w!, h!],
          );
          await page.waitForFunction(
            ([w, h]) => {
              const b = document.querySelector('anima-icon')!.player!.layoutBox('child');
              return b?.width === w! - 4 && b.height === h! - 4;
            },
            [w!, h!],
          );
          await page.evaluate(
            () =>
              new Promise<void>((r) =>
                requestAnimationFrame(() => requestAnimationFrame(() => r())),
              ),
          );
          const actual = PNG.sync.read(await page.locator('anima-icon').screenshot());
          const expected = PNG.sync.read(
            readFileSync(
              new URL(
                `../../../../tests/oracle/host-api-fit-layout/rive/${w}x${h}/frames/0.png`,
                import.meta.url,
              ),
            ),
          );
          expect([actual.width, actual.height]).toEqual([w, h]);
          expect(Buffer.compare(actual.data, expected.data)).toBe(0);
        }
      }, 30_000);
      it(`${renderer}: all nine alignments and legacy aliases are live`, async () => {
        for (const [alignment, ax, ay] of [
          ['top-left', 0, 0],
          ['top-center', 0.5, 0],
          ['top-right', 1, 0],
          ['center-left', 0, 0.5],
          ['center', 0.5, 0.5],
          ['center-right', 1, 0.5],
          ['bottom-left', 0, 1],
          ['bottom-center', 0.5, 1],
          ['bottom-right', 1, 1],
          ['top', 0.5, 0],
          ['left', 0, 0.5],
          ['right', 1, 0.5],
          ['bottom', 0.5, 1],
          ['not-left', 0.5, 0.5],
        ] as const) {
          const result = await page.evaluate(
            ({ renderer, alignment }) => {
              const i = document.querySelector('anima-icon')!;
              i.setAttribute('renderer', renderer);
              i.fit = 'none';
              i.alignment = alignment;
              const b = i.getBoundingClientRect(),
                p = i.inputPoint(b.x, b.y);
              return [p.x, p.y];
            },
            { renderer, alignment },
          );
          expect(result[0], alignment).toBeCloseTo(-2 - 216 * ax, 4);
          expect(result[1], alignment).toBeCloseTo(-1 - 88 * ay, 4);
        }
      });
      it(`${renderer}: size overrides are detached, resettable and local to one player`, async () => {
        const result = await page.evaluate(
          (d) => {
            const i = document.querySelector('anima-icon')!;
            i.setAttribute('renderer', d.renderer);
            i.fit = 'fill';
            const other = document.createElement('anima-icon');
            document.body.append(other);
            other.load(d.scene);
            const initial = i.size;
            initial[0] = 999;
            i.size = [48, 24];
            const resized = i.size;
            const b = i.getBoundingClientRect(),
              point = i.inputPoint(b.x + b.width, b.y + b.height);
            const original = other.size;
            i.resetSize();
            return {
              resized,
              point: [point.x, point.y],
              original,
              reset: i.size,
              authored: i.player!.model.viewBox,
            };
          },
          { renderer, scene },
        );
        expect(result).toEqual({
          resized: [48, 24],
          point: [expect.closeTo(46, 4), expect.closeTo(23, 4)],
          original: [24, 12],
          reset: [24, 12],
          authored: [-2, -1, 24, 12],
        });
      });
      it(`${renderer}: real root reflows on host resize and restores authored sizing`, async () => {
        const result = await page.evaluate(async (renderer) => {
          const i = document.querySelector('anima-icon')!;
          i.setAttribute('renderer', renderer);
          i.load({
            anima: '0.1',
            name: 'responsive',
            grid: 20,
            requires: ['layout'],
            nodes: [
              {
                id: 'root',
                type: 'layout',
                width: 24,
                height: 12,
                padding: 2,
                fill: { color: '#fff' },
                children: [
                  {
                    id: 'child',
                    type: 'rect',
                    x0: 0,
                    y0: 0,
                    w: 1,
                    h: 1,
                    layout: { width: 'fill', height: 'fill' },
                    fill: { color: '#f00' },
                  },
                ],
              },
            ],
          });
          const wait = () =>
            new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
          await wait();
          const p = i.player!;
          i.fit = 'layout';
          await wait();
          const dynamic = [p.layoutBox('root'), p.layoutBox('child')];
          i.style.width = '160px';
          i.style.height = '80px';
          await wait();
          await wait();
          const resized = [p.layoutBox('root'), p.layoutBox('child')];
          i.fit = 'contain';
          await wait();
          const restored = p.layoutBox('root');
          return { dynamic, resized, restored };
        }, renderer);
        expect(result).toEqual({
          dynamic: [
            { x: 0, y: 0, width: 240, height: 100 },
            { x: 2, y: 2, width: 236, height: 96 },
          ],
          resized: [
            { x: 0, y: 0, width: 160, height: 80 },
            { x: 2, y: 2, width: 156, height: 76 },
          ],
          restored: { x: 0, y: 0, width: 24, height: 12 },
        });
      }, 30_000);
      it(`${renderer}: settles through host resize, zero dimensions, disconnect/reconnect and renderer changes`, async () => {
        await page.evaluate((renderer) => {
          const i = document.querySelector('anima-icon')!;
          i.setAttribute('renderer', renderer);
          i.fit = 'fit-width';
          i.alignment = 'bottom-right';
          i.style.width = '120px';
        }, renderer);
        await page.waitForTimeout(60);
        expect(
          await page.evaluate(() => {
            const i = document.querySelector('anima-icon')!,
              b = i.getBoundingClientRect();
            return i.inputPoint(b.x, b.y).y;
          }),
        ).toBeCloseTo(-9, 4);
        await page.evaluate(() => {
          const i = document.querySelector('anima-icon')!;
          i.remove();
          i.style.width = '0px';
          document.body.append(i);
        });
        await page.waitForTimeout(40);
        await page.evaluate(() => {
          document.querySelector('anima-icon')!.style.width = '240px';
        });
        await page.waitForTimeout(60);
        expect(
          await page.evaluate(() => {
            const i = document.querySelector('anima-icon')!,
              b = i.getBoundingClientRect();
            return i.inputPoint(b.x, b.y).y;
          }),
        ).toBeCloseTo(1, 4);
      });
    }
    it('accepts a size before load and clears an override without leaving layout state behind', async () => {
      const result = await page.evaluate((d) => {
        const i = document.createElement('anima-icon');
        const before = i.size;
        i.size = [48, 24];
        const pending = i.size;
        document.body.append(i);
        i.style.cssText = 'width:16px;height:8px';
        i.load(d);
        i.fit = 'layout';
        i.resetSize();
        const responsive = i.size;
        i.removeAttribute('fit');
        return {
          before,
          pending,
          responsive,
          authored: i.size,
          override: (i.player as HostLayoutPlayer).layoutSize,
        };
      }, scene);
      expect(result).toEqual({
        before: [0, 0],
        pending: [48, 24],
        responsive: [16, 8],
        authored: [24, 12],
        override: undefined,
      });
    });
    it('preserves the unrequested SVG grid/bleed default, including after fit removal', async () => {
      const result = await page.evaluate(() => {
        const i = document.querySelector('anima-icon')!,
          svg = i.shadowRoot!.querySelector('svg')!;
        const initial = svg.getScreenCTM()!.toString();
        i.fit = 'cover';
        i.removeAttribute('fit');
        return {
          initial,
          reset: svg.getScreenCTM()!.toString(),
          ratio: getComputedStyle(i).aspectRatio,
        };
      });
      expect(result.reset).toBe(result.initial);
      expect(result.ratio).toBe('24 / 12');
    });
    it('scale-down shrinks but never enlarges; invalid sizes report host diagnostics', async () => {
      const result = await page.evaluate(() => {
        const i = document.querySelector('anima-icon')!;
        const errors: unknown[] = [];
        i.addEventListener('anima:error', (e) => errors.push((e as CustomEvent).detail));
        i.fit = 'scale-down';
        i.style.width = '12px';
        i.style.height = '8px';
        i.attributeChangedCallback('fit', null, 'scale-down');
        const scale = i.shadowRoot!.querySelector('svg')!.getScreenCTM()!.a;
        for (const size of [[0, 1], [-1, 2], [Infinity, 3], [NaN, 1], [1], null, Array(2)])
          i.size = size as [number, number];
        return { scale, size: i.size, errors };
      });
      expect(result.scale).toBe(0.5);
      expect(result.size).toEqual([24, 12]);
      expect(result.errors).toHaveLength(7);
      expect(result.errors[0]).toEqual([
        {
          code: 'host-size',
          severity: 'error',
          pointer: '',
          message: 'invalid artboard size',
          hint: expect.any(String),
        },
      ]);
    });
  });
