import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type Page } from 'playwright-core';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type {} from '../../web/index.ts';
import type {} from '../../../focus/core/index.ts';
const root = new URL('../../../../', import.meta.url);
const doc = {
  anima: '0.1',
  name: 'integration',
  grid: 20,
  requires: ['components', 'focus', 'input', 'machine'],
  inputs: { activated: { type: 'bool' }, key: { type: 'number' }, drag: { type: 'number' } },
  a11y: { role: 'button', label: 'Integration', activate: 'activated' },
  nodes: [
    ...['a', 'b', 'c'].map((id, i) => ({
      id,
      type: 'circle',
      center: [2 + i * 6, 2],
      r: 1,
      fill: { color: '#000' },
      focus: { bounds: [1 + i * 6, 1, 2, 2], tabStops: true },
    })),
    { id: 'marker', type: 'circle', center: [2, 10], r: 1, fill: { color: '#000' } },
  ],
  machine: {
    layers: {
      l: {
        initial: 'a',
        states: {
          a: {
            pose: { 'marker.x': 0 },
            on: [
              {
                when: '@after(0)',
                to: 'b',
                guard: { left: { focus: 'b' }, op: '==', right: true },
              },
            ],
          },
          b: {
            pose: { 'marker.x': 5 },
            on: [
              {
                when: '@after(0)',
                to: 'a',
                guard: { left: { focus: 'b' }, op: '==', right: false },
              },
            ],
          },
        },
      },
    },
  },
  listeners: [
    { on: 'key-down', key: 'ArrowRight', target: 'a', set: { key: 1 } },
    { on: 'key-down', key: 'Enter', set: { key: 2 } },
    { on: 'drag', target: 'b', write: { dx: 'drag' } },
    { on: 'focus', target: 'b', emit: 'b-focus' },
    { on: 'blur', target: 'b', emit: 'b-blur' },
  ],
};
for (const order of [
  ['components', 'focus', 'input', 'machine'],
  ['machine', 'input', 'focus', 'components'],
] as const)
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
    describe.skipIf(!existsSync(executablePath))(
      `interaction integration ${name} ${order.join('→')}`,
      () => {
        let browser: Browser, page: Page, codes: string[];
        beforeAll(async () => {
          codes = await Promise.all(
            ['index', ...order].map((n) =>
              bundle(new URL(`packages/web/src/${n}.ts`, root).pathname),
            ),
          );
          browser = await engine.launch({
            executablePath,
            headless: true,
            args: name === 'Chromium' ? ['--no-sandbox'] : [],
          });
        }, 30000);
        afterAll(async () => browser?.close());
        beforeEach(async () => {
          page = await browser.newPage();
          await page.setContent(
            '<button id="before">Before</button><anima-icon motion="full" style="display:block;width:200px;height:200px"></anima-icon><button id="after">After</button>',
          );
          for (const code of codes) {
            await page.addScriptTag({ type: 'module', content: code });
            await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
          }
          await page.waitForFunction(() => !!document.querySelector('anima-icon')!.input);
          await page.evaluate((d) => {
            const i = document.querySelector('anima-icon')!;
            if (!i.load(d)) throw Error('interaction document did not load');
          }, doc);
        });
        afterEach(async () => page.close());
        const focused = () =>
          page.evaluate(() => document.querySelector('anima-icon')!.player!.focused);
        it('dispatches one key route, traverses arrows/Tab once and preserves native activation', async () => {
          await page.locator('#before').focus();
          await page.keyboard.press('Tab');
          expect(await focused()).toBe('a');
          await page.evaluate(() => {
            const p = document.querySelector('anima-icon')!.player!,
              original = p.focusKey;
            (window as unknown as { calls: number }).calls = 0;
            p.focusKey = function (...args) {
              (window as unknown as { calls: number }).calls++;
              return original.apply(this, args);
            };
          });
          await page.keyboard.press('ArrowRight');
          expect(await focused()).toBe('b');
          expect(await page.evaluate(() => document.querySelector('anima-icon')!.get('key'))).toBe(
            1,
          );
          // Key down and key up each call the focus route once; only down traverses.
          expect(await page.evaluate(() => (window as unknown as { calls: number }).calls)).toBe(2);
          await page.keyboard.press('Tab');
          expect(await focused()).toBe('c');
          await page.keyboard.press('Tab');
          expect(await page.evaluate(() => document.activeElement?.id)).toBe('after');
          await page.keyboard.press('Shift+Tab');
          expect(await focused()).toBe('c');
          await page.keyboard.press('Shift+Tab');
          expect(await focused()).toBe('b');
          await page.keyboard.press('Enter');
          expect(await page.evaluate(() => document.querySelector('anima-icon')!.get('key'))).toBe(
            2,
          );
          expect(
            await page.evaluate(() => document.querySelector('anima-icon')!.get('activated')),
          ).toBe(true);
          await page.keyboard.down('Space');
          expect(
            await page.evaluate(() => document.querySelector('anima-icon')!.get('activated')),
          ).toBe(true);
          await page.keyboard.up('Space');
          expect(
            await page.evaluate(() => document.querySelector('anima-icon')!.get('activated')),
          ).toBe(false);
        });
        it('cooperates with real pointer capture and focuses once while dragging outside the icon', async () => {
          const b = await page.locator('anima-icon').boundingBox();
          await page.mouse.move(b!.x + 80, b!.y + 20);
          await page.mouse.down();
          expect(await focused()).toBe('b');
          expect(
            await page.evaluate(() =>
              document
                .querySelector('anima-icon')!
                .shadowRoot!.activeElement?.getAttribute('data-focus'),
            ),
          ).toBe('b');
          await page.mouse.move(b!.x + 260, b!.y + 20);
          await expect
            .poll(() => page.evaluate(() => document.querySelector('anima-icon')!.get('drag')))
            .toBeCloseTo(18, 6);
          await page.mouse.up();
          expect(await focused()).toBe('b');
        });
        it('wakes a settled machine on focus and blur through the live focus reader', async () => {
          await page.evaluate(() => document.querySelector('anima-icon')!.player!.focusTarget('a'));
          await expect
            .poll(() =>
              page.evaluate(() => document.querySelector('anima-icon')!.player!.step(0).settled),
            )
            .toBe(true);
          await page.evaluate(() => document.querySelector('anima-icon')!.player!.focusTarget('b'));
          await expect
            .poll(() =>
              page.evaluate(() => document.querySelector('anima-icon')!.player!.value('marker.x')),
            )
            .toBe(5);
          expect(
            await page.evaluate(() =>
              document.querySelector('anima-icon')!.player!.machineFocus?.('b'),
            ),
          ).toBe(true);
          await page.locator('#after').focus();
          await expect
            .poll(() =>
              page.evaluate(() => document.querySelector('anima-icon')!.player!.value('marker.x')),
            )
            .toBe(0);
        });
        it('routes keys to a focused component descendant and validates unknown dotted events', async () => {
          await page.evaluate((d) => {
            const i = document.querySelector('anima-icon')!;
            i.load({
              anima: '0.1',
              name: 'nested',
              grid: 20,
              requires: d.requires,
              inputs: { outer: { type: 'number' } },
              listeners: [
                { on: 'key-down', target: 'child', capture: true, set: { outer: 1 } },
                { on: 'key-down', target: 'child', set: { outer: 2 } },
              ],
              components: {
                child: {
                  grid: 20,
                  nodes: d.nodes.slice(0, 3),
                  inputs: { key: { type: 'number' } },
                  listeners: [
                    { on: 'key-down', target: 'a', key: 'k', consume: true, set: { key: 7 } },
                  ],
                },
              },
              nodes: [{ id: 'child', type: 'instance', component: 'child' }],
            });
            i.player!.focusTarget('child.a');
          }, doc);
          await page.keyboard.press('k');
          expect(
            await page.evaluate(() => document.querySelector('anima-icon')!.get('child.key')),
          ).toBe(7);
          expect(
            await page.evaluate(() => document.querySelector('anima-icon')!.get('outer')),
          ).toBe(1);
          await page.keyboard.press('ArrowRight');
          expect(
            await page.evaluate(() => document.querySelector('anima-icon')!.get('outer')),
          ).toBe(2);
          expect(await focused()).toBe('child.b');
          expect(
            await page.evaluate(
              (d) =>
                document
                  .querySelector('anima-icon')!
                  .load({ ...d, listeners: [{ on: 'missing.output', set: { key: 1 } }] }),
              doc,
            ),
          ).toEqual([
            expect.objectContaining({
              code: 'unknown-event',
              pointer: '/listeners/0/on',
              severity: 'error',
            }),
          ]);
        });
      },
    );
