import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type Page } from 'playwright-core';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../web/index.ts';

const leaf = (id: string, role = 'button', extra = {}) => ({
  id,
  type: 'rect',
  x0: 0,
  y0: 0,
  w: 4,
  h: 4,
  a11y: { role, label: id, ...extra },
});
const scene = (nodes: object[], extra = {}) => ({
  anima: '0.1',
  name: 'issues-a11y',
  grid: 20,
  requires: ['a11y', 'focus'],
  nodes,
  ...extra,
});
const machine = {
  layers: {
    l: {
      initial: 'idle',
      states: {
        idle: { pose: {}, on: [{ when: 'go', to: 'done' }] },
        done: { pose: {}, emit: 'sent' },
      },
    },
  },
};
let compiled: Promise<string[]> | undefined;
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
  describe.skipIf(!existsSync(executablePath))(`A11Y issues ${name}`, () => {
    let browser: Browser, page: Page, scripts: string[];
    beforeAll(async () => {
      scripts = await (compiled ??= Promise.all(
        ['index', 'a11y-navigation', 'focus', 'components', 'input'].map((n) =>
          bundle(resolve(`packages/web/src/${n}.ts`)),
        ),
      ));
      browser = await engine.launch({
        executablePath,
        headless: true,
        args: name === 'Chromium' ? ['--no-sandbox'] : [],
      });
    }, 60000);
    afterAll(async () => {
      await browser?.close();
    });
    beforeEach(async () => {
      page = await browser.newPage();
      await page.setContent(
        '<button id="before">Before</button><anima-icon paused style="width:200px;height:200px"></anima-icon><button id="after">After</button>',
      );
      for (const [i, script] of scripts.entries()) {
        await page.addScriptTag({ type: 'module', content: script });
        await page.waitForFunction((i) => {
          const C = customElements.get('anima-icon') as typeof AnimaIcon;
          return i === 0
            ? !!C
            : i === 1
              ? !!C.prototype.semanticAction
              : i === 2
                ? !!C.prototype.focusNext
                : C.modules.has(i === 3 ? 'components' : 'input');
        }, i);
      }
    }, 30000);
    afterEach(async () => {
      await page.close();
    });
    const target = (id: string) => page.locator(`[data-semantic="${id}"]`);
    const active = () =>
      page.evaluate(() =>
        document
          .querySelector('anima-icon')!
          .shadowRoot!.activeElement?.getAttribute('data-semantic'),
      );
    const load = async (doc: object) =>
      expect(
        await page.evaluate((d) => document.querySelector('anima-icon')!.load(d), doc),
      ).toEqual([]);
    const observe = () =>
      page.evaluate(() => {
        const icon = document.querySelector('anima-icon')!;
        document.body.dataset.events = '[]';
        document.body.dataset.states = '[]';
        for (const [kind, key] of [
          ['anima:event', 'events'],
          ['anima:state', 'states'],
        ])
          icon.addEventListener(kind!, (e) => {
            const list = JSON.parse(document.body.dataset[key!]!);
            list.push((e as CustomEvent).detail);
            document.body.dataset[key!] = JSON.stringify(list);
          });
      });
    for (const nested of [false, true])
      it(`#32 Enter dispatches state-entry events and states, nested=${nested}`, async () => {
        const nodes = [leaf('button', 'button', { activate: 'go' })];
        const inputs = { go: { type: 'trigger' } };
        await load(
          nested
            ? scene([{ id: 'child', type: 'instance', component: 'control' }], {
                requires: ['a11y', 'focus', 'components'],
                components: { control: { grid: 20, inputs, nodes, machine } },
              })
            : scene(nodes, { inputs, machine }),
        );
        const id = nested ? 'child.button' : 'button';
        await target(id).focus();
        await observe();
        await page.keyboard.press('Enter');
        const state = await page.evaluate(() =>
          document.querySelector('anima-icon')!.player!.states(),
        );
        expect(state[nested ? 'child/l' : 'l']).toBe('done');
        const events = JSON.parse((await page.locator('body').getAttribute('data-events'))!);
        expect(events).toEqual([expect.objectContaining({ name: nested ? 'child.sent' : 'sent' })]);
        expect(JSON.parse((await page.locator('body').getAttribute('data-states'))!)).toEqual([
          state,
        ]);
      }, 30000);
    it('#32 semantic focus dispatches listener events and state changes synchronously', async () => {
      await load(
        scene([leaf('button')], {
          inputs: { go: { type: 'trigger' } },
          machine,
          listeners: [{ on: 'focus', target: 'button', fire: 'go' }],
        }),
      );
      await observe();
      await target('button').focus();
      expect(JSON.parse((await page.locator('body').getAttribute('data-events'))!)).toEqual([
        expect.objectContaining({ name: 'sent' }),
      ]);
      expect(JSON.parse((await page.locator('body').getAttribute('data-states'))!)).toEqual([
        { l: 'done' },
      ]);
    }, 30000);
    it('#32 semantic increase dispatches state-entry events synchronously', async () => {
      const changeMachine = structuredClone(machine);
      changeMachine.layers.l.states.idle.on[0]!.when = 'level >= 1';
      await load(
        scene([leaf('range', 'slider', { value: 'level', min: 0, max: 10, step: 1 })], {
          inputs: { level: { type: 'number', default: 0 } },
          machine: changeMachine,
        }),
      );
      await observe();
      expect(
        await page.evaluate(() =>
          document.querySelector('anima-icon')!.semanticAction('range', 'increase'),
        ),
      ).toBe(true);
      expect(JSON.parse((await page.locator('body').getAttribute('data-events'))!)).toEqual([
        expect.objectContaining({ name: 'sent' }),
      ]);
      expect(JSON.parse((await page.locator('body').getAttribute('data-states'))!)).toEqual([
        { l: 'done' },
      ]);
    }, 30000);
    it('#33 disabled focus scope keeps its role, accessible subtree and enabled roving tabs', async () => {
      await load(
        scene([
          {
            id: 'tabs',
            type: 'group',
            focus: { enabled: false, scope: true, edge: 'closed-loop' },
            a11y: { role: 'tab-list', label: 'Views' },
            children: [leaf('a', 'tab'), leaf('b', 'tab')],
          },
        ]),
      );
      expect(await target('tabs').getAttribute('hidden')).toBeNull();
      expect(await page.locator('anima-icon').ariaSnapshot()).toContain('tablist "Views"');
      await target('a').focus();
      expect(await active()).toBe('a');
      await page.keyboard.press('ArrowRight');
      expect(await active()).toBe('b');
      await page.keyboard.press('ArrowRight');
      expect(await active()).toBe('a');
    }, 30000);
    it('#34 toolbar uses one tab stop, both arrow axes and Home/End', async () => {
      await load(
        scene(
          [
            {
              id: 'tools',
              type: 'group',
              a11y: { role: 'toolbar', label: 'Tools' },
              children: [
                leaf('a'),
                leaf('off', 'button', { disabled: true }),
                leaf('b'),
                leaf('c'),
              ],
            },
          ],
          { requires: ['a11y', 'focus', 'input'] },
        ),
      );
      expect(await page.locator('anima-icon').ariaSnapshot()).toContain('toolbar "Tools"');
      await page.locator('#before').focus();
      await page.keyboard.press('Tab');
      expect(await active()).toBe('a');
      for (const [key, id] of [
        ['ArrowDown', 'b'],
        ['ArrowRight', 'c'],
        ['ArrowUp', 'b'],
        ['Home', 'a'],
        ['End', 'c'],
        ['ArrowRight', 'a'],
        ['ArrowLeft', 'c'],
      ]) {
        await page.keyboard.press(key!);
        expect(await active()).toBe(id);
        expect(await page.locator('[data-semantic][tabindex="0"]').count()).toBe(1);
      }
      await page.keyboard.press('Tab');
      expect(await page.locator('#after').evaluate((el) => el === document.activeElement)).toBe(
        true,
      );
    }, 30000);
    it('#34 roves without logical focus and skips disabled cells without changing column indices', async () => {
      const row = (id: string, children: object[]) => ({
        id,
        type: 'group',
        a11y: { role: 'row' },
        children,
      });
      await load(
        scene(
          [
            {
              id: 'grid',
              type: 'group',
              a11y: { role: 'grid' },
              children: [
                row('r0', [
                  leaf('a', 'gridcell'),
                  leaf('off', 'gridcell', { disabled: true }),
                  leaf('c', 'gridcell'),
                ]),
                row('r1', [leaf('d', 'gridcell'), leaf('e', 'gridcell')]),
              ],
            },
          ],
          { requires: ['a11y'] },
        ),
      );
      await target('a').focus();
      for (const [key, id] of [
        ['ArrowRight', 'c'],
        ['ArrowDown', 'c'],
        ['Home', 'a'],
        ['ArrowDown', 'd'],
        ['End', 'e'],
        ['ArrowUp', 'e'],
      ]) {
        await page.keyboard.press(key!);
        expect(await active()).toBe(id);
        expect(await page.locator('[data-semantic][tabindex="0"]').count()).toBe(1);
      }
      expect(await target('off').getAttribute('tabindex')).toBe('-1');
    }, 30000);
    it('#34 toolbar respects focus order and a grid row can traverse its parent scope', async () => {
      await load(
        scene([
          {
            id: 'tools',
            type: 'group',
            a11y: { role: 'toolbar' },
            children: [
              { ...leaf('later'), focus: { order: 2, tabStops: true } },
              { ...leaf('first'), focus: { order: 1, tabStops: true } },
            ],
          },
        ]),
      );
      await target('first').focus();
      await page.keyboard.press('ArrowRight');
      expect(await active()).toBe('later');
      await load(
        scene([
          { ...leaf('outside'), x0: -8 },
          {
            id: 'grid',
            type: 'group',
            a11y: { role: 'grid' },
            children: [
              {
                id: 'row',
                type: 'group',
                a11y: { role: 'row' },
                focus: { enabled: false, scope: true, edge: 'parent-scope' },
                children: [leaf('cell', 'gridcell')],
              },
            ],
          },
        ]),
      );
      await target('cell').focus();
      await page.keyboard.press('ArrowLeft');
      expect(await active()).toBe('outside');
    }, 30000);
    for (const edge of ['stop', 'closed-loop', 'parent-scope'])
      it(`#34 grid uses 2-D row/column roving, edge=${edge}, page keys pass through`, async () => {
        const row = (id: string, cells: string[]) => ({
          id,
          type: 'group',
          a11y: { role: 'row' },
          focus: { enabled: false, scope: true, edge },
          children: cells.map((id) => leaf(id, 'gridcell')),
        });
        await load(
          scene(
            [
              {
                id: 'grid',
                type: 'group',
                a11y: { role: 'grid', label: 'Dates' },
                children: [row('r0', ['a', 'b', 'c']), row('r1', ['d', 'e', 'f'])],
              },
            ],
            { requires: ['a11y', 'focus', 'input'] },
          ),
        );
        expect(await page.locator('anima-icon').ariaSnapshot()).toContain('grid "Dates"');
        await page.locator('#before').focus();
        await page.keyboard.press('Tab');
        expect(await active()).toBe('a');
        for (const [key, id] of [
          ['ArrowRight', 'b'],
          ['ArrowDown', 'e'],
          ['ArrowUp', 'b'],
          ['End', 'c'],
          ['Home', 'a'],
          ['Control+End', 'f'],
          ['Control+Home', 'a'],
          ['ArrowLeft', edge === 'closed-loop' ? 'c' : 'a'],
        ]) {
          await page.keyboard.press(key!);
          expect(await active()).toBe(id);
          expect(await page.locator('[data-semantic][tabindex="0"]').count()).toBe(1);
        }
        await page.evaluate(() => {
          document.body.dataset.keys = '[]';
          document.body.addEventListener('keydown', (e) => {
            if (e.key.startsWith('Page')) {
              const keys = JSON.parse(document.body.dataset.keys!);
              keys.push([e.key, e.defaultPrevented]);
              document.body.dataset.keys = JSON.stringify(keys);
            }
          });
        });
        for (const key of ['PageUp', 'PageDown']) await page.keyboard.press(key);
        expect(JSON.parse((await page.locator('body').getAttribute('data-keys'))!)).toEqual([
          ['PageUp', false],
          ['PageDown', false],
        ]);
        await page.keyboard.press('Tab');
        expect(await page.locator('#after').evaluate((el) => el === document.activeElement)).toBe(
          true,
        );
      }, 30000);
  });
