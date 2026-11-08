import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import { testFont } from '../../../../tools/test-font.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import { liveDocument } from '../live-document.ts';
const bundles = await Promise.all(
  ['index', 'data', 'host-values', 'host', 'text', 'canvas'].map((e) =>
    cachedBundle(resolve(`packages/web/src/${e}.ts`)),
  ),
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
    `${name} live list and typed styles match literal SVG/canvas controls after mutation`,
    async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent(
          '<anima-icon id="live" paused style="display:block;width:240px;height:240px"></anima-icon><anima-icon id="control" paused style="display:block;width:240px;height:240px"></anima-icon>',
        );
        await page.evaluate(async (b) => {
          document.fonts.add(
            await new FontFace(
              'Anima Test',
              Uint8Array.from(atob(b), (c) => c.charCodeAt(0)),
            ).load(),
          );
        }, testFont().toString('base64'));
        for (const content of bundles) await page.addScriptTag({ type: 'module', content });
        await page.waitForFunction(
          () =>
            ['text', 'host', 'data'].every((m) =>
              (customElements.get('anima-icon') as typeof AnimaIcon).modules.has(m),
            ) && !!(customElements.get('anima-icon') as typeof AnimaIcon).renderers.canvas,
        );
        await page.evaluate(async (doc) => {
          for (const id of ['live', 'control']) {
            const icon = document.getElementById(id) as AnimaIcon;
            const loaded = new Promise<void>((r, reject) => {
              icon.addEventListener('anima:load', () => r(), { once: true });
              icon.addEventListener(
                'anima:error',
                (e) => reject(Error(JSON.stringify((e as CustomEvent).detail))),
                { once: true },
              );
            });
            icon.load(doc);
            await loaded;
          }
        }, liveDocument());
        for (const renderer of ['svg', 'canvas']) {
          await page.evaluate((renderer) => {
            for (const icon of document.querySelectorAll('anima-icon'))
              icon.setAttribute('renderer', renderer);
          }, renderer);
          for (const alternate of [true, false]) {
            const state = await page.evaluate(
              ({ alternate }) => {
                const icon = document.getElementById('live') as AnimaIcon,
                  p = icon.player!;
                const value = alternate ? 'WXYZ' : 'AB',
                  style = alternate ? 'alternate' : 'normal';
                p.data.bind('main');
                p.data.string('items.0.label').set(value);
                p.data.textStyle('items.0.ink').set(style);
                p.data.textStyle('style').set(style);
                p.step(0);
                icon.invalidate();
                return {
                  value,
                  style,
                  typed: p.get('$style'),
                  xml: icon.shadowRoot!.querySelector('svg')?.outerHTML,
                };
              },
              { alternate },
            );
            expect(state.typed).toBe(state.style);
            if (renderer === 'svg') expect(state.xml).toContain(`>${state.value}</tspan>`);
            const control = liveDocument();
            control.nodes = [
              { ...control.nodes[0]!, runs: [{ text: state.value, style: state.style }] },
              { ...control.nodes[1]!, runs: [{ text: 'CD', style: state.style }] },
            ];
            await page.evaluate(async (doc) => {
              const icon = document.getElementById('control') as AnimaIcon;
              const ready = new Promise<void>((r) =>
                icon.addEventListener('anima:load', () => r(), { once: true }),
              );
              icon.load(doc);
              await ready;
            }, control);
            // Both hosts redraw on their next frames; capture only after they have painted.
            await page.evaluate(
              () =>
                new Promise<void>((r) =>
                  requestAnimationFrame(() => requestAnimationFrame(() => r())),
                ),
            );
            // CI paints later than local runs: retry until both hosts have painted (exact match
            // still required). On failure, report what differs so CI logs show the cause.
            try {
              await expect
                .poll(
                  async () =>
                    Buffer.compare(
                      await page.locator('#live').screenshot(),
                      await page.locator('#control').screenshot(),
                    ),
                  { timeout: 3000, interval: 100 },
                )
                .toBe(0);
            } catch (error) {
              const detail = await page.evaluate(() => {
                const svg = (id: string) =>
                  document.getElementById(id)!.shadowRoot!.querySelector('svg')?.outerHTML ?? '';
                const pixels = (id: string) => {
                  const c = document.getElementById(id)!.shadowRoot!.querySelector('canvas');
                  if (!c) return null;
                  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
                  return d.filter((_, i) => i % 4 === 3 && d[i]! > 0).length;
                };
                return {
                  live: svg('live'),
                  control: svg('control'),
                  inked: [pixels('live'), pixels('control')],
                };
              });
              throw new Error(
                `${renderer} alternate=${alternate}: live != control\n` +
                  JSON.stringify(detail).slice(0, 6000),
                { cause: error },
              );
            }
          }
        }
      } finally {
        await browser.close();
      }
    },
    30000,
  );
