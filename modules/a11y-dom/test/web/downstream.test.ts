import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type Page } from 'playwright-core';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { PNG } from 'pngjs';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../web/index.ts';
import type {} from '../../../input/web/index.ts';
import type {} from '../../../focus/web/index.ts';

let compiled: Promise<string[]> | undefined;
const scene = (name: string) =>
  JSON.parse(readFileSync(new URL(`fixtures/bf2-${name}.json`, import.meta.url), 'utf8'));
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
  describe.skipIf(!existsSync(executablePath))(`[BF-2] downstream ${name}`, () => {
    let browser: Browser, page: Page;
    let scripts: string[];
    beforeAll(async () => {
      scripts = await (compiled ??= Promise.all(
        ['index', 'a11y-dom', 'input', 'focus', 'components', 'host-edit'].map((n) =>
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
      await page.setContent('<anima-icon fit="fill" style="width:240px;height:70px"></anima-icon>');
      for (let i = 0; i < 3; i++) {
        await page.addScriptTag({ type: 'module', content: scripts[i]! });
        await page.waitForFunction((index) => {
          const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
          return index === 0
            ? !!Icon
            : index === 1
              ? !!Icon.prototype.semanticAction
              : !!Icon.prototype.input;
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
    const target = (id: string) => page.locator(`[data-semantic="${id}"]`);
    const value = (key: string) =>
      page.evaluate((k) => document.querySelector('anima-icon')!.get(k), key);
    const withFocus = async () => {
      await page.addScriptTag({ type: 'module', content: scripts[3]! });
      await page.waitForFunction(() =>
        document.querySelector('anima-icon')!.hasAttribute('data-focus-ready'),
      );
    };
    const active = () =>
      page.evaluate(() =>
        document
          .querySelector('anima-icon')!
          .shadowRoot!.activeElement?.getAttribute('data-semantic'),
      );

    it('B2: one ArrowRight moves one tab with input and focus loaded', async () => {
      await withFocus();
      const doc = scene('tabs');
      doc.requires.push('focus');
      await load(doc);
      await target('tab0').focus();
      await page.keyboard.press('ArrowRight');
      expect(await active()).toBe('tab1');
      expect(await page.evaluate(() => document.querySelector('anima-icon')!.player!.focused)).toBe(
        'tab1',
      );
      await page.keyboard.press('End');
      expect(await active()).toBe('tab2');
      await page.keyboard.press('ArrowRight');
      expect(await active()).toBe('tab0');
    });
    for (const useFocus of [false, true]) {
      it(`B2: native trigger button activation works with focus=${useFocus}`, async () => {
        if (useFocus) await withFocus();
        const doc = scene('buttons');
        if (useFocus) doc.requires.push('focus');
        await load(doc);
        // Observe actual accepted trigger calls without changing action or step behavior.
        await page.evaluate(() => {
          const p = document.querySelector('anima-icon')!.player!;
          const fire = p.fire;
          document.body.dataset.fires = '0';
          p.fire = function (key) {
            document.body.dataset.fires = String(Number(document.body.dataset.fires) + 1);
            return fire.call(this, key);
          };
        });
        await target('plus').focus();
        await page.keyboard.press('Enter');
        expect(await page.locator('body').getAttribute('data-fires')).toBe('1');
        await page.keyboard.down('Space');
        expect(await page.locator('body').getAttribute('data-fires')).toBe('1');
        await page.keyboard.up('Space');
        expect(await page.locator('body').getAttribute('data-fires')).toBe('2');
        await target('plus').dispatchEvent('click');
        expect(await page.locator('body').getAttribute('data-fires')).toBe('3');
      });
      it(`B3: tabs activate manually on Enter/Space with focus=${useFocus}`, async () => {
        if (useFocus) await withFocus();
        const doc = scene('tabs');
        if (useFocus) doc.requires.push('focus');
        await load(doc);
        await target('tab0').focus();
        await page.keyboard.press('ArrowRight');
        expect(await active()).toBe('tab1');
        expect(await value('pick1')).toBe(false);
        await page.keyboard.press('Enter');
        expect(await value('pick1')).toBe(true);
        await page.keyboard.press('ArrowRight');
        expect(await active()).toBe('tab2');
        expect(await value('pick2')).toBe(false);
        await page.keyboard.down('Space');
        expect(await value('pick2')).toBe(false);
        await page.keyboard.up('Space');
        expect(await value('pick2')).toBe(true);
      });
    }
    for (const useInput of [false, true])
      it(`B6: input=${useInput}, drawing receives hover, press and drag while overlay retains keyboard/AT actions`, async () => {
        const doc = scene('pointer');
        if (!useInput) {
          doc.requires = ['a11y'];
          doc.listeners = doc.listeners.filter((l: { on: string }) => l.on !== 'drag');
        }
        await load(doc);
        const box = (await page.locator('anima-icon').boundingBox())!;
        await page.mouse.move(box.x + 30, box.y + 30);
        await expect.poll(() => value('hover')).toBe(true);
        await page.mouse.down();
        await expect.poll(() => value('pressed')).toBe(true);
        await page.mouse.move(box.x + 100, box.y + 30, { steps: 3 });
        if (useInput) await expect.poll(() => value('dragged')).toBe(true);
        await page.mouse.up();
        await expect.poll(() => value('pressed')).toBe(false);
        // Real hit testing must target the SVG drawing, not its semantic twin.
        expect(
          await page.evaluate(
            ([x, y]) =>
              document.querySelector('anima-icon')!.shadowRoot!.elementFromPoint(x!, y!)?.localName,
            [box.x + 30, box.y + 30],
          ),
        ).toBe('rect');
        await target('drawing').focus();
        const previous = await value('on');
        await page.keyboard.press('Enter');
        expect(await value('on')).toBe(!previous);
        const before = await value('on');
        await target('drawing').dispatchEvent('click');
        expect(await value('on')).toBe(!before);
      });
    it('B7: native range parts never paint, even at a large drawing scale', async () => {
      await load(scene('range'));
      const transparent = PNG.sync.read(await target('range').screenshot());
      await page.evaluate(() => {
        const e = document
          .querySelector('anima-icon')!
          .shadowRoot!.querySelector<HTMLElement>('[data-semantic="range"]')!;
        // Remove opacity as a safety net: native thumb/track must themselves be invisible.
        e.style.opacity = '1';
      });
      const png = PNG.sync.read(await target('range').screenshot());
      expect(png.data).toEqual(transparent.data);
      let painted = 0;
      for (let i = 0; i < png.data.length; i += 4)
        if (png.data[i] !== 18 || png.data[i + 1] !== 52 || png.data[i + 2] !== 86) painted++;
      expect(painted).toBe(0);
      await target('range').focus();
      await page.keyboard.press('ArrowRight');
      expect(await value('level')).toBe(45);
    });
    it('B8: document and shown component use viewBox aspect without overriding authored dimensions', async () => {
      await load(scene('buttons'));
      await page.evaluate(() => document.querySelector('anima-icon')!.removeAttribute('style'));
      const box = () => page.locator('anima-icon').boundingBox();
      const initial = (await box())!;
      expect(initial.width / initial.height).toBeCloseTo(24 / 7, 1);
      await page.evaluate(() => {
        document.querySelector('anima-icon')!.style.width = '240px';
      });
      expect((await box())!.height).toBeCloseTo(70);
      await page.evaluate(() => {
        document.querySelector('anima-icon')!.style.height = '91px';
      });
      expect((await box())!.height).toBeCloseTo(91);
      expect((await box())!.width).toBeCloseTo(240);
      await page.addScriptTag({ type: 'module', content: scripts[4]! });
      await page.waitForFunction(() =>
        (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('components'),
      );
      await page.addScriptTag({ type: 'module', content: scripts[5]! });
      await page.waitForFunction(() =>
        (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('hostedit'),
      );
      const component = scene('buttons');
      await page.evaluate((d) => {
        const icon = document.querySelector('anima-icon')!;
        icon.removeAttribute('style');
        icon.setAttribute('component', 'stepper');
        return icon.load({
          anima: '0.1',
          name: 'library',
          grid: 20,
          requires: ['components', ...d.requires],
          nodes: [],
          components: {
            stepper: { grid: d.grid, viewBox: d.viewBox, nodes: d.nodes, inputs: d.inputs },
          },
        });
      }, component);
      expect((await box())!.width / (await box())!.height).toBeCloseTo(24 / 7, 1);
    });
  });
