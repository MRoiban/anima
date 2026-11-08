import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import { PNG } from 'pngjs';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type { text } from '../../core/index.ts';
import { testFont } from '../../../../tools/test-font.ts';
import { Font } from '../../../../packages/cli/src/font/reader.ts';
import { ToolMeasurer } from '../../../../packages/cli/src/font/measure.ts';
const bytes = testFont();
const tool = new ToolMeasurer();
tool.register('Anima Test', new Font(bytes));
const expected = tool.measure(
  { family: 'Anima Test', size: 2, weight: 400, style: 'normal', tracking: 0 },
  'AV<&😀',
).advances;
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
    ['index', 'text'],
    ['text', 'index'],
    ['index', 'paint', 'components', 'data', 'lists', 'componentpaint', 'text'],
    ['index', 'text', 'componentpaint', 'lists', 'data', 'components', 'paint'],
  ])
    it.skipIf(!existsSync(executablePath))(
      `${name} text ${order.join('→')}: prefix metrics, escaped retained SVG, host replacement and canvas pixels`,
      async () => {
        const browser = await engine.launch({ executablePath, headless: true });
        try {
          const page = await browser.newPage();
          await page.evaluate(async (base64) => {
            const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
            const face = await new FontFace('Anima Test', bytes).load();
            document.fonts.add(face);
          }, bytes.toString('base64'));
          await page.setContent(
            '<anima-icon style="width:240px;height:240px;color:black"></anima-icon>',
          );
          for (const entry of [...order, 'text-host', 'canvas'])
            await page.addScriptTag({
              type: 'module',
              content: await cachedBundle(resolve('packages/web/src/' + entry + '.ts')),
            });
          await page.waitForFunction(
            () => !!(customElements.get('anima-icon') as typeof AnimaIcon).modules.get('text'),
          );
          const result = await page.evaluate(async () => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            const doc = {
              anima: '0.1',
              name: 'browser-text',
              grid: 20,
              requires: ['text'],
              inputs: { queued: { type: 'bool', default: false } },
              nodes: [
                {
                  id: 'label',
                  type: 'text',
                  x: 1,
                  y: 1,
                  sizing: 'fixed',
                  width: 18,
                  height: 16,
                  styles: { s: { font: 'Anima Test', size: 2, fill: { color: '#000' } } },
                  runs: [{ id: 'value', style: 's', text: 'AV<&😀' }],
                },
              ],
            };
            const loaded = new Promise<void>((r) =>
              icon.addEventListener('anima:load', () => r(), { once: true }),
            );
            icon.load(doc);
            await loaded;
            const module = (icon.constructor as typeof AnimaIcon).modules.get(
              'text',
            ) as typeof text;
            const layout = module.textLayout(icon.player!, 0);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            ctx.font = '400 2px "Anima Test"';
            ctx.fontKerning = 'normal';
            ctx.textRendering = 'geometricPrecision';
            const before = icon.shadowRoot!.querySelector('tspan')!.textContent;
            const prefix = layout.lines[0]!.clusters.slice(0, 2)
              .map((c) => c.advance)
              .reduce((a, b) => a + b, 0);
            const native = ctx.measureText('AV').width;
            icon.textRun('label', 'value', 'Changed & safe');
            icon.player!.set('queued', true);
            document.fonts.dispatchEvent(new Event('loadingdone'));
            const queuedAfterFonts = icon.player!.get('queued');
            return {
              before,
              queuedAfterFonts,
              after: icon.shadowRoot!.querySelector('tspan')!.textContent,
              prefix,
              native,
              positions: layout.lines[0]!.clusters.map((c) => c.x + c.advance),
            };
          });
          expect(result.queuedAfterFonts).toBe(false);
          expect(result.before).toBe('AV<&😀');
          expect(result.after).toBe('Changed & safe');
          expect(result.prefix).toBeCloseTo(result.native, 5);
          expected.forEach((x, i) => expect(Math.abs(result.positions[i]! - x)).toBeLessThan(0.01));
          for (const entry of ['markup', 'markup-text'])
            await page.addScriptTag({
              type: 'module',
              content: await cachedBundle(resolve('packages/web/src/' + entry + '.ts')),
            });
          await page.waitForFunction(
            () => !!(customElements.get('anima-icon') as typeof AnimaIcon).markupHooks.text,
          );
          const diagnostics = await page.evaluate(
            () =>
              (customElements.get('anima-icon') as typeof AnimaIcon).compiler!(
                '<anima version="0.1" name="text-markup" grid="20" requires="text"><text-style id="s" size="2"/><text id="t"><run style="s" text="label"/></text></anima>',
              ).diagnostics,
          );
          expect(diagnostics).toEqual([]);
          const svg = PNG.sync.read(await page.locator('anima-icon').screenshot());
          expect([...svg.data].filter((v, i) => i % 4 !== 3 && v < 100).length).toBeGreaterThan(50);
          await page.evaluate(() =>
            document.querySelector('anima-icon')!.setAttribute('renderer', 'canvas'),
          );
          const canvas = PNG.sync.read(await page.locator('anima-icon').screenshot());
          expect([...canvas.data].filter((v, i) => i % 4 !== 3 && v < 100).length).toBeGreaterThan(
            50,
          );
        } finally {
          await browser.close();
        }
      },
      30000,
    );
