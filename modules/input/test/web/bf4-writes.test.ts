import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type Page } from 'playwright-core';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../../input/web/index.ts';
import type {} from '../../../focus/web/index.ts';

let compiled: Promise<string[]> | undefined;
const doc = JSON.parse(
  readFileSync(new URL('../fixtures/bf4-writes.json', import.meta.url), 'utf8'),
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
  describe.skipIf(!existsSync(executablePath))(`[BF-4 writes] downstream ${name}`, () => {
    let browser: Browser, page: Page;
    let scripts: string[];
    beforeAll(async () => {
      scripts = await (compiled ??= Promise.all(
        ['index', 'input', 'focus', 'components', 'data', 'bind', 'lists'].map((n) =>
          bundle(resolve(`packages/web/src/${n}.ts`)),
        ),
      ));
      browser = await engine.launch({
        executablePath,
        headless: true,
        args: name === 'Chromium' ? ['--no-sandbox'] : [],
      });
    }, 30000);
    afterAll(async () => {
      await browser?.close();
    });
    beforeEach(async () => {
      page = await browser.newPage();
      page.on('pageerror', (e) => console.error(e.message));
      await page.setContent(
        '<anima-icon fit="fill" style="width:800px;height:200px"></anima-icon>',
      );
      for (const [i, script] of scripts.entries()) {
        await page.addScriptTag({ type: 'module', content: script });
        await page.waitForFunction((i) => {
          const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
          return i === 0
            ? !!Icon
            : Icon.modules.has(['', 'input', 'focus', 'components', 'data', 'bind', 'lists'][i]!);
        }, i);
      }
    });
    afterEach(async () => {
      await page.close();
    });
    const load = async (doc: object) => {
      expect(
        await page.evaluate((d) => document.querySelector('anima-icon')!.load(d), doc),
      ).toEqual([]);
    };

    it('B19: real pointer and key writes reach plain, nested and repeated data', async () => {
      await load(doc);
      const icon = page.locator('anima-icon');
      const move = async (x: number, y: number) => {
        const at = await icon.evaluate(
          (i, [x, y]) => {
            const p = new DOMPoint(x, y).matrixTransform(
              i.shadowRoot!.querySelector('svg')!.getScreenCTM()!,
            );
            return { x: p.x, y: p.y };
          },
          [x, y],
        );
        await page.mouse.move(at.x, at.y);
      };
      const read = (key: string) =>
        page.evaluate((k) => document.querySelector('anima-icon')!.get(k), key);
      for (const [offset, path, target] of [
        [0, '', 'pad'],
        [20, 'child.leaf.', 'outer.inner.pad'],
        [40, 'rows.0.', 'rows.0.pad'],
        [60, 'rows.1.', 'rows.1.pad'],
      ] as const) {
        // These y coordinates map to integer CSS pixels in both engines.
        await move(offset + 5, 4);
        await move(offset + 8, 8);
        await expect.poll(() => read('$' + path + 'x'), { message: path }).toBeCloseTo(8, 5);
        expect(await read('$' + path + 'y')).toBeCloseTo(8, 5);
        expect(await read('$' + path + 'dx')).toBeCloseTo(3, 5);
        expect(await read('$' + path + 'dy')).toBeCloseTo(4, 5);
        await page.mouse.down();
        await page.mouse.up();
        await expect.poll(() => read('$' + path + 'n')).toBe(7);
        await page.mouse.down();
        await page.mouse.up();
        await expect.poll(() => read('$' + path + 'copy')).toBe(7);
        await page.evaluate(
          (id) => document.querySelector('anima-icon')!.player!.focusTarget(id),
          target,
        );
        await page.keyboard.press('Escape');
        await expect.poll(() => read('$' + path + 'key')).toBe('Escape');
      }
    });
  });
