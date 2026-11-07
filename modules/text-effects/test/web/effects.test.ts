import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import { testFont } from '../../../../tools/test-font.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type { CanvasSourceHost } from '../../../canvas/web/sources.ts';
import type { DrawNode } from '@anima-format/core';
import type { text } from '../../../text/core/index.ts';
import type { textEffects } from '../../core/index.ts';
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
  for (const order of [
    ['text', 'text-effects', 'canvas'],
    ['text-effects', 'canvas', 'text'],
  ])
    it.skipIf(!existsSync(executablePath))(
      `${name} effects ${order.join('→')}: SVG/canvas transforms, opacity, auto direction and retained animation`,
      async () => {
        const browser = await engine.launch({ executablePath, headless: true });
        try {
          const page = await browser.newPage();
          await page.setContent('<anima-icon style="width:240px;height:240px"></anima-icon>');
          await page.evaluate(async (b64) => {
            const face = await new FontFace(
              'Anima Test',
              Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)),
            ).load();
            document.fonts.add(face);
          }, testFont().toString('base64'));
          for (const entry of order)
            await page.addScriptTag({
              type: 'module',
              content: await cachedBundle(resolve('packages/web/src/' + entry + '.ts')),
            });
          await page.waitForFunction(
            () =>
              !!(customElements.get('anima-icon') as typeof AnimaIcon).modules.get('texteffects'),
          );
          const result = await page.evaluate(async () => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            const Icon = customElements.get('anima-icon') as CanvasSourceHost;
            const loaded = new Promise<void>((r) =>
              icon.addEventListener('anima:load', () => r(), { once: true }),
            );
            icon.load({
              anima: '0.1',
              name: 'browser-effects',
              grid: 20,
              requires: ['text', 'texteffects'],
              nodes: [
                {
                  id: 'label',
                  type: 'text',
                  styles: { s: { font: 'Anima Test', size: 2, fill: { color: '#000' } } },
                  runs: [{ id: 'first', text: 'AV', style: 's' }],
                  background: { first: '#ff0000' },
                  effects: [{ y: 2, rotate: 20, scaleX: 1.2, opacity: 0.4 }],
                },
              ],
              timelines: {
                wave: {
                  duration: 1,
                  tracks: {
                    'label.effects.0.y': [
                      [0, 2],
                      [1, 0],
                    ],
                  },
                },
              },
              machine: {
                layers: { main: { initial: 'wave', states: { wave: { play: 'wave' } } } },
              },
            });
            await loaded;
            icon.pause();
            const svgBefore = [...icon.shadowRoot!.querySelectorAll('text')].map((el) => ({
              text: el.textContent,
              x: +el.getAttribute('x')!,
              y: +el.getAttribute('y')!,
              transform: el.getAttribute('transform'),
              opacity: +el.getAttribute('opacity')!,
            }));
            const shape = { paints: [] } as unknown as DrawNode;
            const t = Icon.modules.get('text') as typeof text;
            const e = Icon.modules.get('texteffects') as typeof textEffects;
            t.draw!.frame!(icon.player!, 0, shape, null!, null!);
            e.draw!.frame!(icon.player!, 0, shape, null!, null!);
            const canvas = document.createElement('canvas');
            canvas.width = 240;
            canvas.height = 240;
            document.body.append(canvas);
            const ctx = canvas.getContext('2d')!;
            const records: {
              text: string;
              x: number;
              y: number;
              matrix: number[];
              opacity: number;
            }[] = [];
            const original = ctx.fillText.bind(ctx);
            ctx.fillText = (text, x, y) => {
              const m = ctx.getTransform();
              records.push({
                text,
                x,
                y,
                matrix: [m.a, m.b, m.c, m.d, m.e, m.f],
                opacity: ctx.globalAlpha,
              });
              original(text, x, y);
            };
            Icon.canvasShapes![0]!(ctx, shape, (p) => String(p.color ?? '#000'));
            const pixels = ctx
              .getImageData(0, 0, 240, 240)
              .data.filter((_v, i) => i % 4 === 3 && _v > 0).length;
            icon.player!.step(0.5);
            icon.attributeChangedCallback('renderer', null, 'svg');
            const after = icon.shadowRoot!.querySelector('text')!.getAttribute('transform');
            const backgrounds = icon.shadowRoot!.querySelector('rect')!.getAttribute('fill');
            const data = (
              shape as DrawNode & { text: { direction: string; runs: { text: string }[] } }
            ).text;
            canvas.remove(); // Native :dir resolution also covers detached canvas compositing surfaces.
            data.direction = 'auto';
            data.runs = [{ text: 'אב ab' }];
            Icon.canvasShapes![0]!(ctx, shape, (p) => String(p.color ?? '#000'));
            const dirRestored = canvas.dir === '';
            const originalAgain = ctx.fillText;
            let nativeDirection = '';
            ctx.fillText = (text, x, y) => {
              nativeDirection = ctx.direction;
              originalAgain(text, x, y);
            };
            Icon.canvasShapes![0]!(ctx, shape, (p) => String(p.color ?? '#000'));
            return {
              svgBefore,
              records: records.slice(0, 2),
              after,
              backgrounds,
              pixels,
              auto: nativeDirection,
              dirRestored,
            };
          });
          expect(result.svgBefore.map((c) => c.text)).toEqual(['A', 'V']);
          expect(result.backgrounds).toBe('#ff0000');
          expect(result.pixels).toBeGreaterThan(0);
          expect(result.auto).toBe('rtl');
          expect(result.dirRestored).toBe(true);
          result.svgBefore.forEach((s, i) => {
            const c = result.records[i]!;
            expect(c.text).toBe(s.text);
            expect(c.x).toBeCloseTo(s.x, 4);
            expect(c.y).toBeCloseTo(s.y, 4);
            expect(c.opacity).toBeCloseTo(s.opacity, 4);
            const matrix = s
              .transform!.match(/matrix\(([^)]+)\)/)![1]!
              .split(' ')
              .map(Number);
            matrix.forEach((v, j) => expect(c.matrix[j]).toBeCloseTo(v, 4));
          });
          expect(result.after).not.toBe(result.svgBefore[0]!.transform);
          await page.addScriptTag({
            type: 'module',
            content:
              (await cachedBundle(resolve('packages/web/src/text.ts'))) +
              '\nReflect.set(globalThis, "__lateTextReady", true);',
          });
          await page.waitForFunction(() => Reflect.get(globalThis, '__lateTextReady') === true);
          const late = await page.evaluate(() => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            icon.attributeChangedCallback('renderer', null, 'svg');
            return [...icon.shadowRoot!.querySelectorAll('text')].map((t) => [
              t.textContent,
              t.getAttribute('transform'),
              t.getAttribute('opacity'),
            ]);
          });
          expect(late.map((x) => x[0])).toEqual(['A', 'V']);
          late.forEach((x) => {
            expect(x[1]).toContain('matrix(');
            expect(x[2]).toBe('0.4');
          });
        } finally {
          await browser.close();
        }
      },
      30000,
    );
