// seam(P6-9b): semantics must never consume a drawing invalidation for bound run values.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import { testFont } from '../../../../tools/test-font.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
const entries = ['index', 'data', 'a11y', 'a11y-text', 'text', 'canvas'];
const bundles = await Promise.all(
  entries.map((e) => cachedBundle(resolve(`packages/web/src/${e}.ts`))),
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
    `${name} semantic reads before/after shorthand writes preserve SVG and canvas drawing`,
    async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent(
          '<anima-icon paused style="display:block;width:240px;height:240px"></anima-icon>',
        );
        await page.evaluate(async (base64) => {
          document.fonts.add(
            await new FontFace(
              'Anima Test',
              Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
            ).load(),
          );
        }, testFont().toString('base64'));
        for (const content of bundles) await page.addScriptTag({ type: 'module', content });
        await page.waitForFunction(
          () =>
            ['text', 'data', 'a11y'].every((n) =>
              (customElements.get('anima-icon') as typeof AnimaIcon).modules.has(n),
            ) && !!(customElements.get('anima-icon') as typeof AnimaIcon).renderers.canvas,
        );
        await page.evaluate(async () => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const loaded = new Promise<void>((r) =>
            icon.addEventListener('anima:load', () => r(), { once: true }),
          );
          icon.load({
            anima: '0.1',
            name: 'shorthand',
            grid: 20,
            requires: ['text', 'data', 'a11y'],
            data: {
              models: { Main: { properties: { title: { type: 'string', default: 'Old' } } } },
            },
            nodes: [
              {
                id: 'title',
                type: 'text',
                x: 1,
                y: 1,
                styles: { s: { font: 'Anima Test', size: 2 } },
                runs: [{ style: 's', text: '$title' }],
                a11y: { role: 'text', label: '$title' },
              },
            ],
          });
          await loaded;
        });
        for (const renderer of ['svg', 'canvas']) {
          await page.evaluate(
            (renderer) => document.querySelector('anima-icon')!.setAttribute('renderer', renderer),
            renderer,
          );
          const before = await page.locator('anima-icon').screenshot();
          const expected = renderer === 'svg' ? 'Changed' : 'Much longer';
          const state = await page.evaluate((value) => {
            const icon = document.querySelector('anima-icon') as AnimaIcon,
              p = icon.player!;
            const before = p.semantics()[0]!.label;
            p.set('$title', value);
            p.step(0);
            const label = p.semantics()[0]!.label;
            icon.invalidate();
            const text = icon.shadowRoot!.querySelector('tspan')?.textContent;
            return { before, label, text };
          }, expected);
          expect(state.label).toBe(expected);
          if (renderer === 'svg') expect(state.text).toBe(expected);
          expect(await page.locator('anima-icon').screenshot()).not.toEqual(before);
          // Returning to the previous value must recover identical pixels, including after semantic reads.
          await page.evaluate((value) => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            icon.player!.set('$title', value!);
            icon.player!.step(0);
            icon.player!.semantics();
            icon.invalidate();
          }, state.before);
          expect(await page.locator('anima-icon').screenshot()).toEqual(before);
        }
      } finally {
        await browser.close();
      }
    },
    30000,
  );
