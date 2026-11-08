// Rottweiler P6 regressions (design/rottweiler/P6-LEDGER.md).
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../web/index.ts';
const entries = ['index', 'input', 'focus', 'a11y', 'text', 'text-input'];
const bundles = await Promise.all(
  entries.map((name) => cachedBundle(resolve('packages/web/src/' + name + '.ts'))),
);
const doc = {
  anima: '0.1',
  name: 'shrinking-field',
  grid: 20,
  requires: ['text', 'textinput', 'a11y', 'focus'],
  nodes: [
    {
      id: 'q',
      type: 'text',
      sizing: 'fixed',
      width: 10,
      height: 4,
      styles: { s: { size: 1 } },
      runs: [{ text: 'ab', style: 's' }],
      textInput: {},
    },
  ],
  timelines: {
    t: {
      duration: 0.05,
      tracks: {
        'q.width': [
          [0, 10],
          [0.05, 5],
        ],
      },
    },
  },
  machine: { layers: { l: { initial: 's', states: { s: { play: 't' } } } } },
};
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
] as const) {
  it.skipIf(!existsSync(executablePath))(
    `${name}: R1-07 the native editing surface follows animated field dimensions`,
    async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent(
          '<anima-icon style="position:relative;display:block;width:200px;height:200px"></anima-icon>',
        );
        for (const content of bundles) await page.addScriptTag({ type: 'module', content });
        await page.waitForFunction(
          () => !!(customElements.get('anima-icon') as typeof AnimaIcon).modules.get('textinput'),
        );
        const width = () =>
          page.evaluate(() => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            return [icon.player?.prop(0, 'width'), icon.textInput('q')?.style.width];
          });
        const errors = await page.evaluate((d) => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          return icon.load(d).filter((x) => x.severity === 'error');
        }, doc);
        expect(errors).toEqual([]);
        await expect.poll(width, { timeout: 5000 }).toEqual([5, '5px']);
      } finally {
        await browser.close();
      }
    },
    30000,
  );
  it.skipIf(!existsSync(executablePath))(
    `${name}: R3-08 core selection changes reach the native field; native selections are kept`,
    async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent(
          '<anima-icon style="position:relative;display:block;width:200px;height:200px"></anima-icon>',
        );
        for (const content of bundles) await page.addScriptTag({ type: 'module', content });
        await page.waitForFunction(
          () => !!(customElements.get('anima-icon') as typeof AnimaIcon).modules.get('textinput'),
        );
        type Core = typeof import('../../core/index.ts');
        const read = () =>
          page.evaluate(() => {
            const el = document.querySelector('anima-icon')!.textInput('q')!;
            return [el.selectionStart, el.selectionEnd];
          });
        const field = {
          anima: doc.anima,
          name: 'select-field',
          grid: doc.grid,
          requires: doc.requires,
          nodes: [{ ...doc.nodes[0]!, runs: [{ text: 'abc', style: 's' }] }],
        };
        const errors = await page.evaluate(
          (d) =>
            document
              .querySelector('anima-icon')!
              .load(d)
              .filter((x) => x.severity === 'error'),
          field,
        );
        expect(errors).toEqual([]);
        await page.waitForFunction(() => !!document.querySelector('anima-icon')!.textInput('q'));
        await page.evaluate(() => {
          const icon = document.querySelector('anima-icon')!;
          const m = (customElements.get('anima-icon') as typeof AnimaIcon).modules.get(
            'textinput',
          ) as unknown as Core;
          m.select(icon.player!, 'q', 0, 2);
          icon.invalidate();
        });
        await expect.poll(read, { timeout: 5000 }).toEqual([0, 2]);
        // A native selection not yet synced to core (e.g. mid-drag) survives a redraw.
        await page.evaluate(() => {
          const icon = document.querySelector('anima-icon')!;
          icon.textInput('q')!.setSelectionRange(1, 3);
          icon.invalidate();
        });
        expect(await read()).toEqual([1, 3]);
      } finally {
        await browser.close();
      }
    },
    30000,
  );
  it.skipIf(!existsSync(executablePath))(
    `${name}: R4-02 keyboard selection keeps extending backward`,
    async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent(
          '<anima-icon style="position:relative;display:block;width:200px;height:200px"></anima-icon>',
        );
        for (const content of bundles) await page.addScriptTag({ type: 'module', content });
        await page.waitForFunction(
          () => !!(customElements.get('anima-icon') as typeof AnimaIcon).modules.get('textinput'),
        );
        const errors = await page.evaluate(() =>
          document
            .querySelector('anima-icon')!
            .load({
              anima: '0.1',
              name: 'backward',
              grid: 20,
              requires: ['text', 'textinput', 'a11y', 'focus'],
              nodes: [
                {
                  id: 't',
                  type: 'text',
                  sizing: 'fixed',
                  width: 18,
                  height: 5,
                  runs: [{ text: 'abcdef' }],
                  textInput: {},
                },
              ],
            })
            .filter((d) => d.severity === 'error'),
        );
        expect(errors).toEqual([]);
        await page.waitForFunction(() => !!document.querySelector('anima-icon')!.textInput('t'));
        await page.evaluate(() => {
          const el = document.querySelector('anima-icon')!.textInput('t')!;
          el.focus();
          el.setSelectionRange(4, 4);
          el.dispatchEvent(new Event('select'));
        });
        const read = () =>
          page.evaluate(() => {
            const el = document.querySelector('anima-icon')!.textInput('t')!;
            return [el.selectionStart, el.selectionEnd];
          });
        for (const expected of [
          [3, 4],
          [2, 4],
          [1, 4],
        ]) {
          await page.keyboard.press('Shift+ArrowLeft');
          await page.waitForTimeout(100);
          expect(await read()).toEqual(expected);
        }
      } finally {
        await browser.close();
      }
    },
    30000,
  );
}
