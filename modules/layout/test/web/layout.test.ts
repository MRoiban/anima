import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import { testFont } from '../../../../tools/test-font.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../core/index.ts';
for (const [name, engine, path] of [
  [
    'Chromium',
    chromium,
    '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['Firefox', firefox, '.cache/ms-playwright/firefox-1555/firefox/firefox'],
] as const)
  for (const renderer of ['svg', 'canvas'])
    it.skipIf(!existsSync(resolve(homedir(), path)))(
      `${name} layout ${renderer}: nested paint, hidden children, data-bound text hug and late markup registration`,
      async () => {
        const browser = await engine.launch({
          executablePath: resolve(homedir(), path),
          headless: true,
        });
        try {
          const page = await browser.newPage();
          await page.setContent(
            `<anima-icon renderer="${renderer}" style="width:240px;height:240px;color:black" paused></anima-icon>`,
          );
          await page.evaluate(async (base64) => {
            const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
            const face = await new FontFace('Anima Test', bytes).load();
            document.fonts.add(face);
            await document.fonts.ready;
          }, testFont().toString('base64'));
          for (const entry of [
            'index',
            'text',
            'data',
            'bind',
            'layout',
            'markup',
            'markup-layout',
            'markup-hooks',
            'markup-text',
            'canvas',
          ])
            await page.addScriptTag({
              type: 'module',
              content: await cachedBundle(resolve('packages/web/src/' + entry + '.ts')),
            });
          await page.waitForFunction(
            () => !!(customElements.get('anima-icon') as typeof AnimaIcon).modules.get('layout'),
          );
          const result = await page.evaluate(async (renderer) => {
            const icon = document.querySelector('anima-icon') as AnimaIcon,
              Icon = icon.constructor as typeof AnimaIcon;
            const source =
              '<anima version="0.1" name="button" grid="20" requires="layout text data bind"><model name="Main"><string name="label" default="Go"/></model><layout id="button" x="2" y="2" width="hug" height="hug" padding="1 2" gap="1" fill="#d97757"><text id="label" layout-width="hug"><style id="body" font="Anima Test" size="2"/><run text="$label" style="body"/></text><rect id="hidden" x0="0" y0="0" width="4" height="4" fill="#000" display="none"/></layout></anima>';
            const compiled = Icon.compiler!(source);
            if (!compiled.doc) throw Error(JSON.stringify(compiled.diagnostics));
            const loaded = new Promise<void>((res, rej) => {
              icon.addEventListener('anima:load', () => res(), { once: true });
              icon.addEventListener(
                'anima:error',
                (e) => rej(new Error(JSON.stringify((e as CustomEvent).detail))),
                { once: true },
              );
            });
            icon.load(compiled.doc);
            await loaded;
            const wait = () =>
              new Promise<void>((res) =>
                requestAnimationFrame(() => requestAnimationFrame(() => res())),
              );
            await wait();
            const before = icon.player!.layoutBox('button')!;
            icon.player!.set('$label', 'Longer');
            icon.player!.step(0);
            icon.invalidate();
            await wait();
            const after = icon.player!.layoutBox('button')!,
              label = icon.player!.layoutBox('label')!,
              hidden = icon.player!.layoutBox('hidden')!;
            const element = icon.shadowRoot!.querySelector(renderer === 'svg' ? 'rect' : 'canvas')!;
            let pixel: number[] | undefined;
            if (renderer === 'canvas') {
              const canvas = element as HTMLCanvasElement;
              const ctx = canvas.getContext('2d')!;
              pixel = [...ctx.getImageData(30, 30, 1, 1).data];
            }
            let groupPixel: number[] | undefined;
            if (renderer === 'canvas') {
              const loaded = new Promise<void>((res) =>
                icon.addEventListener('anima:load', () => res(), { once: true }),
              );
              icon.load({
                anima: '0.1',
                name: 'group-opacity',
                grid: 20,
                requires: ['layout'],
                nodes: [
                  {
                    id: 'group',
                    type: 'layout',
                    width: 10,
                    height: 10,
                    padding: 1,
                    opacity: 0.5,
                    fill: { color: '#00f' },
                    children: [
                      {
                        id: 'child',
                        type: 'rect',
                        x0: 0,
                        y0: 0,
                        w: 2,
                        h: 2,
                        fill: { color: '#f00' },
                      },
                    ],
                  },
                ],
              });
              await loaded;
              await wait();
              const c = icon.shadowRoot!.querySelector('canvas')!;
              groupPixel = [...c.getContext('2d')!.getImageData(20, 20, 1, 1).data];
            }
            return {
              groupPixel,
              before,
              after,
              label,
              hidden,
              svg: renderer === 'svg' ? icon.shadowRoot!.querySelector('svg')!.outerHTML : '',
              pixel,
            };
          }, renderer);
          expect(result.before.width).toBeCloseTo(6.4, 1);
          expect(result.after.width).toBeCloseTo(11.2, 1);
          expect(result.after.width).toBeCloseTo(result.label.width + 4, 5);
          expect(result.hidden.width).toBe(0);
          if (renderer === 'svg') {
            expect(result.svg).toContain('Longer');
            expect(result.svg).toContain('fill="#d97757"');
          } else {
            expect(result.pixel).toEqual([217, 119, 87, 255]);
            expect(result.groupPixel!.slice(0, 3)).toEqual([255, 0, 0]);
            expect(result.groupPixel![3]).toBeGreaterThanOrEqual(127);
            expect(result.groupPixel![3]).toBeLessThanOrEqual(128);
          }
        } finally {
          await browser.close();
        }
      },
      45_000,
    );
