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
  describe.skipIf(!existsSync(executablePath))(`[BF-4] downstream ${name}`, () => {
    let browser: Browser, page: Page;
    let scripts: string[];
    beforeAll(async () => {
      scripts = await (compiled ??= Promise.all(
        ['index', 'a11y-dom', 'input', 'focus', 'components', 'host-edit', 'machine'].map((n) =>
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

    for (const useFocus of [false, true])
      it(`B15: radio group has one entry, arrow selects and Tab leaves; focus=${useFocus}`, async () => {
        if (useFocus) await withFocus();
        const doc = scene('tabs');
        if (useFocus) doc.requires.push('focus');
        doc.nodes[0].a11y.role = 'radio-group';
        for (const [i, node] of doc.nodes[0].children.entries()) {
          node.a11y.role = 'radio';
          delete node.a11y.selected;
          node.a11y.checked = `pick${i}`;
          node.a11y.activate = `pickRadio${i}`;
          doc.inputs[`pickRadio${i}`] = { type: 'trigger' };
        }
        // Explicit group exclusivity is author-owned, not a second DOM write policy.
        doc.requires.push('machine');
        doc.machine = {
          layers: {
            selection: {
              initial: 'none',
              states: Object.fromEntries(
                [-1, 0, 1, 2].map((i) => [
                  i < 0 ? 'none' : `s${i}`,
                  {
                    pose: {},
                    ...(i < 0
                      ? {}
                      : {
                          enterActions: {
                            set: Object.fromEntries([0, 1, 2].map((j) => [`pick${j}`, i === j])),
                          },
                        }),
                    on: [0, 1, 2].map((j) => ({ when: `pickRadio${j}`, to: `s${j}` })),
                  },
                ]),
              ),
            },
          },
        };
        await page.evaluate(() => {
          document.body.insertAdjacentHTML('afterbegin', '<button id="before">Before</button>');
          document.body.insertAdjacentHTML('beforeend', '<button id="after">After</button>');
        });
        await page.addScriptTag({ type: 'module', content: scripts[6]! });
        await page.waitForFunction(() =>
          (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('machine'),
        );
        await load(doc);
        expect(await target('tab0').getAttribute('tabindex')).toBe('0');
        expect(await target('tab1').getAttribute('tabindex')).toBe('-1');
        await page.locator('#before').focus();
        await page.keyboard.press('Tab');
        expect(await active()).toBe('tab0');
        await page.keyboard.press('ArrowRight');
        expect(await active()).toBe('tab1');
        await expect.poll(() => value('pick1')).toBe(true);
        expect(await value('pick0')).toBe(false);
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => document.activeElement?.id)).toBe('after');
        await page.keyboard.press('Shift+Tab');
        expect(await active()).toBe('tab1');
      });
    it('BF-2 recheck: scaled slider and queued trigger activation work without focus', async () => {
      await page.evaluate(
        () => (document.querySelector('anima-icon')!.style.cssText = 'width:1200px;height:350px'),
      );
      const doc = scene('buttons');
      doc.requires.push('machine');
      doc.inputs.level = { type: 'number', default: 40 };
      doc.nodes.unshift({
        id: 'range',
        type: 'rect',
        x0: 8,
        y0: 0,
        w: 8,
        h: 7,
        fill: { color: '#123456' },
        a11y: { role: 'slider', label: 'Level', value: 'level', step: 5 },
      });
      doc.machine = {
        layers: {
          bump: {
            initial: 'idle',
            states: {
              idle: { pose: { 'plus.scale': 1 }, on: [{ when: 'bump', to: 'done' }] },
              done: { pose: { 'plus.scale': 0.8 }, enterActions: { set: { on: true } } },
            },
          },
        },
      };
      await page.addScriptTag({ type: 'module', content: scripts[6]! });
      await page.waitForFunction(() =>
        (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('machine'),
      );
      await load(doc);
      await target('plus').focus();
      await page.keyboard.press('Enter');
      await expect.poll(() => value('on')).toBe(true);
      expect(
        await page.evaluate(() =>
          document.querySelector('anima-icon')!.player!.value('plus.scale'),
        ),
      ).toBe(0.8);
      const before = PNG.sync.read(await target('range').screenshot());
      await target('range').evaluate((e) => ((e as HTMLElement).style.opacity = '1'));
      expect(PNG.sync.read(await target('range').screenshot()).data).toEqual(before.data);
      await target('range').focus();
      await page.keyboard.press('ArrowRight');
      expect(await value('level')).toBe(45);
    });
    it('B17: browser roles, numeric state, status, controls, modal and expanded are discoverable', async () => {
      const doc = JSON.parse(
        readFileSync(
          new URL('../../../../spec/conformance/a11y-bf4-roles/case.ani', import.meta.url),
          'utf8',
        ),
      );
      await load(doc);
      expect(await target('progress').getAttribute('role')).toBe('progressbar');
      expect(await target('progress').getAttribute('aria-valuenow')).toBe('40');
      expect(await target('progress').getAttribute('aria-valuemax')).toBe('80');
      expect(await target('pending').getAttribute('aria-valuenow')).toBeNull();
      expect(await target('meter').getAttribute('role')).toBe('meter');
      expect(await target('status').getAttribute('aria-live')).toBe('polite');
      expect(await target('opener').getAttribute('aria-controls')).toBe(
        await target('panel').getAttribute('id'),
      );
      expect(await target('opener').getAttribute('aria-expanded')).toBe('true');
      expect(await target('panel').getAttribute('aria-modal')).toBe('false');
      await page.evaluate(() => {
        const i = document.querySelector('anima-icon')!;
        i.player!.set('amount', 60);
        i.player!.step(0);
      });
      expect(await target('progress').getAttribute('aria-valuenow')).toBe('60');
      doc.nodes.at(-1).a11y.modal = true;
      await load(doc);
      expect(await target('panel').getAttribute('aria-modal')).toBe('true');
      expect(await target('opener').count()).toBe(0);
    });
    it.fails('B16 blocked seam: Escape reaches an ancestor bubble listener', async () => {
      await load(scene('pointer'));
      await page.evaluate(() => {
        for (const type of ['keydown', 'pointerdown', 'pointermove', 'pointerup']) {
          document.body.addEventListener(type, () => {
            document.body.dataset[type] = String(Number(document.body.dataset[type] ?? 0) + 1);
          });
        }
      });
      await target('drawing').focus();
      await page.keyboard.press('Escape');
      expect(await page.locator('body').getAttribute('data-keydown')).toBe('1');
    });
    // Expected failure: input's capture stop needs a base host routing guard in BF-3's file.
    it.fails('B16 blocked seam: input pointer events reach ancestor bubble listeners', async () => {
      await load(scene('pointer'));
      await page.evaluate(() => {
        for (const type of ['pointerdown', 'pointermove', 'pointerup'])
          document.body.addEventListener(type, () => {
            document.body.dataset[type] = 'seen';
          });
      });
      const box = (await page.locator('anima-icon').boundingBox())!;
      await page.mouse.move(box.x + 30, box.y + 30);
      await page.mouse.down();
      await page.mouse.move(box.x + 100, box.y + 30);
      await page.mouse.up();
      for (const type of ['pointerdown', 'pointermove', 'pointerup'])
        expect(await page.locator('body').getAttribute('data-' + type)).toBe('seen');
    });
  });
