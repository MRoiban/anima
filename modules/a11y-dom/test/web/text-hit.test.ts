import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import { testFont } from '../../../../tools/test-font.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../../text/web/hit.ts';
import type {} from '../../web/index.ts';
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
    ['index', 'text', 'a11y-dom', 'a11y-text', 'text-hit', 'input', 'text-host'],
    ['text-hit', 'a11y-text', 'input', 'a11y-dom', 'text-host', 'text', 'index'],
  ])
    it.skipIf(!existsSync(executablePath))(
      `${name} text hit and semantics ${order.join('→')}`,
      async () => {
        const browser = await engine.launch({ executablePath, headless: true });
        try {
          const page = await browser.newPage();
          await page.setContent(
            '<anima-icon paused style="display:block;width:500px;height:500px"></anima-icon>',
          );
          await page.evaluate(async (b64) => {
            const face = await new FontFace(
              'Test',
              Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)),
            ).load();
            document.fonts.add(face);
          }, testFont().toString('base64'));
          for (const entry of order)
            await page.addScriptTag({
              type: 'module',
              content: await cachedBundle(resolve('packages/web/src/' + entry + '.ts')),
            });
          const before = await page.evaluate(async () => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            const loaded = new Promise<void>((r) =>
              icon.addEventListener('anima:load', () => r(), { once: true }),
            );
            icon.load({
              anima: '0.1',
              name: 'text-semantics',
              grid: 100,
              requires: ['text', 'a11y', 'input'],
              inputs: { index: { type: 'number', default: -1 } },
              nodes: [
                {
                  id: 'group',
                  type: 'group',
                  x: 10,
                  y: 20,
                  a11y: { role: 'button' },
                  children: [
                    {
                      id: 'label',
                      type: 'text',
                      styles: { s: { font: 'Test', size: 10 } },
                      runs: [{ id: 'value', style: 's', text: 'A😀B' }],
                      a11y: { role: 'text' },
                    },
                  ],
                },
              ],
              listeners: [{ on: 'down', target: 'label', write: { 'text-index': 'index' } }],
            });
            await loaded;
            return {
              tree: icon.semantics,
              caret: icon.textCaret('label', 1),
              boxes: icon.textSelection('label', 1, 2),
              hit: icon.textHit('label', 7, 5),
              absent: icon.textHit('group', 0, 0),
              aria: icon
                .shadowRoot!.querySelector('[data-semantic="label"]')!
                .getAttribute('aria-label'),
            };
          });
          expect(before.hit).toBe(1);
          expect(before.absent).toBeUndefined();
          expect(before.tree[0]!.label).toBe('A😀B');
          expect(before.aria).toBe('A😀B');
          const bounds = before.tree[0]!.children[0]!.bounds;
          expect(Math.abs(bounds[0] - 10)).toBeLessThan(0.01);
          expect(Math.abs(bounds[1] - 20)).toBeLessThan(0.05);
          expect(Math.abs(bounds[2] - 18)).toBeLessThan(0.05);
          expect(Math.abs(bounds[3] - 10)).toBeLessThan(0.05);
          expect(Math.abs(before.caret![0] - 6)).toBeLessThan(0.05);
          expect(Math.abs(before.boxes![0]![2] - 6)).toBeLessThan(0.05);
          const rect = await page.locator('anima-icon').boundingBox();
          await page.mouse.click(rect!.x + 17 * 5, rect!.y + 25 * 5);
          const after = await page.evaluate(() => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            icon.player!.step(0);
            const hit = icon.player!.get('index');
            const step = icon.player!.step;
            let externalSteps = 0;
            icon.player!.step = function (...args) {
              externalSteps++;
              return step.apply(this, args);
            };
            icon.textRun('label', 'value', 'ABCD');
            icon.player!.step(0);
            const el = icon.shadowRoot!.querySelector('[data-semantic="label"]') as HTMLElement;
            return {
              hit,
              externalSteps,
              tree: icon.semantics,
              label: el.getAttribute('aria-label'),
              width: parseFloat(el.style.width),
            };
          });
          expect(after.hit).toBe(1);
          expect(after.externalSteps).toBe(1);
          expect(after.tree[0]!.label).toBe('ABCD');
          expect(after.label).toBe('ABCD');
          expect(Math.abs(after.width - 24)).toBeLessThan(0.05);
          await page.evaluate(() => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            icon.destroy();
          });
          expect(await page.locator('[data-semantic]').count()).toBe(0);
        } finally {
          await browser.close();
        }
      },
      30000,
    );
