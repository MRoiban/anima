import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import { testFont } from '../../../../tools/test-font.ts';
import { featuresFont } from '../features-font.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type { TextModule } from '../../../text/core/index.ts';

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
    ['text-effects', 'fonts-options'],
    ['fonts-options', 'text-effects', 'text'],
  ])
    it.skipIf(!existsSync(executablePath))(
      `${name} authored font options ${order.join('→')}: rendered axes, features, binding and Canvas fallback`,
      async () => {
        const browser = await engine.launch({ executablePath, headless: true });
        try {
          const page = await browser.newPage();
          await page.setContent(
            '<anima-icon paused style="width:240px;height:240px"></anima-icon>',
          );
          for (const entry of ['assets', 'bind', 'canvas', ...order]) {
            await page.addScriptTag({
              type: 'module',
              content: await cachedBundle(resolve('packages/web/src/' + entry + '.ts')),
            });
            await page.waitForFunction(() => !!customElements.get('anima-icon'));
          }
          await page.waitForFunction(() =>
            (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('text'),
          );
          const result = await page.evaluate(
            async ({ bytes, featureBytes }) => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              const Icon = icon.constructor as typeof AnimaIcon;
              const text = Icon.modules.get('text') as TextModule;
              const errors: unknown[] = [];
              icon.addEventListener('anima:error', (e) => errors.push((e as CustomEvent).detail));
              icon.assets = async (name) =>
                new Blob([new Uint8Array(name === 'body' ? bytes : featureBytes)], {
                  type: 'font/ttf',
                });
              const loaded = new Promise<void>((res, rej) => {
                icon.addEventListener('anima:load', () => res(), { once: true });
                icon.addEventListener('anima:error', () => rej(Error(JSON.stringify(errors))), {
                  once: true,
                });
              });
              icon.load({
                anima: '0.1',
                name: 'font-options',
                grid: 20,
                requires: ['text', 'fonts', 'assets', 'bind', 'texteffects'],
                assets: {
                  body: { type: 'font', source: 'body.ttf' },
                  features: { type: 'font', source: 'features.ttf' },
                },
                inputs: { weight: { type: 'number', default: 400, min: 100, max: 900 } },
                nodes: [
                  {
                    id: 'label',
                    type: 'text',
                    x: 1,
                    y: 1,
                    lineHeight: 1,
                    styles: { s: { font: 'body', size: 2, axes: { wght: 400 } } },
                    runs: [{ text: 'AV', style: 's' }],
                  },
                  {
                    id: 'features',
                    type: 'text',
                    x: 1,
                    y: 5,
                    lineHeight: 1,
                    styles: {
                      s: { font: 'features', size: 2, features: { liga: 0, tnum: 1, kern: 0 } },
                    },
                    runs: [{ text: 'fi1AV', style: 's' }],
                  },
                  {
                    id: 'effect',
                    type: 'text',
                    x: 1,
                    y: 9,
                    lineHeight: 1,
                    styles: {
                      s: { font: 'body', size: 2, axes: { wght: 400 }, features: { kern: 0 } },
                    },
                    runs: [{ text: 'AV', style: 's' }],
                    effects: [{ axes: { wght: 900 } }],
                  },
                ],
                bind: { 'label.styles.s.axes.wght': 'weight' },
              });
              await loaded;
              const wait = async () => {
                for (let i = 0; i < 200; i++) {
                  if (text.textLayout(icon.player!, 0).lines.length) {
                    await new Promise((r) => setTimeout(r, 20));
                    return;
                  }
                  await new Promise((r) => setTimeout(r, 10));
                }
                throw Error('font layout pending');
              };
              await wait();
              const read = () => ({
                axes: text.textLayout(icon.player!, 0).lines[0]!.clusters[0]!.font.axes,
                width: text.textLayout(icon.player!, 1).width,
                svg: icon.shadowRoot!.querySelector('svg')!.outerHTML,
              });
              const before = read();
              icon.player!.set('weight', 900);
              icon.player!.step(0);
              icon.attributeChangedCallback('renderer', null, null);
              await wait();
              const after = read();
              icon.setAttribute('renderer', 'canvas');
              await wait();
              const canvas = icon.shadowRoot!.querySelector('canvas')!;
              const pixels = () => [
                ...canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data,
              ];
              const heavy = pixels();
              icon.player!.set('weight', 400);
              icon.player!.step(0);
              icon.attributeChangedCallback('renderer', null, 'canvas');
              await wait();
              const light = pixels();
              const ctx = canvas.getContext('2d')!;
              return {
                before,
                after,
                errors,
                heavy: heavy.filter((v, i) => i % 4 === 3 && v > 0).length,
                light: light.filter((v, i) => i % 4 === 3 && v > 0).length,
                nativeAxes: 'fontVariationSettings' in ctx,
                nativeFeatures: 'fontFeatureSettings' in ctx,
              };
            },
            { bytes: [...testFont()], featureBytes: [...featuresFont()] },
          );
          expect(result.errors).toEqual([]);
          expect(result.before.axes).toEqual({ wght: 400 });
          expect(result.after.axes).toEqual({ wght: 900 });
          expect(result.after.svg).toContain('font-variation-settings: &quot;wght&quot; 900');
          expect(result.after.svg).toContain(
            'font-feature-settings: &quot;liga&quot; 0, &quot;tnum&quot;',
          );
          expect(result.after.width).toBeCloseTo(result.nativeFeatures ? 6 : 4.8, 1); // Canvas platform default fi ligature = 4 glyphs if unsupported; liga=0 native gives 5.
          expect(result.heavy).toBeGreaterThan(result.light);
        } finally {
          await browser.close();
        }
      },
      30000,
    );
