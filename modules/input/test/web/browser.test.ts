import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type Page } from 'playwright-core';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type {} from '../../web/index.ts';
const root = new URL('../../../../', import.meta.url);
const doc = {
  anima: '0.1',
  name: 'input',
  grid: 20,
  requires: ['input'],
  inputs: {
    x: { type: 'number' },
    y: { type: 'number' },
    pressed: { type: 'bool' },
    down: { type: 'bool' },
    up: { type: 'bool' },
    key: { type: 'bool' },
    scroll: { type: 'number' },
  },
  nodes: [
    {
      id: 'disc',
      type: 'circle',
      center: [10, 10],
      r: 8,
      fill: { color: '#000' },
      cursor: 'pointer',
    },
  ],
  listeners: [
    { on: 'down', set: { down: true } },
    { on: 'up|drag-end', set: { up: true } },
    { on: 'drag', write: { x: 'x', y: 'y' } },
    { on: 'key-down', key: 'k', modifiers: 'control', set: { key: true } },
    { on: 'scroll', target: 'disc', write: { deltaY: 'scroll' } },
  ],
};
for (const [name, engine, executablePath] of [
  [
    'Chromium',
    chromium,
    process.env.CHROMIUM_PATH ??
      resolve(
        homedir(),
        '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
      ),
  ],
  [
    'Firefox',
    firefox,
    process.env.FIREFOX_PATH ??
      resolve(homedir(), '.cache/ms-playwright/firefox-1555/firefox/firefox'),
  ],
] as const)
  describe.skipIf(!existsSync(executablePath))(`input browser ${name}`, () => {
    let browser: Browser, page: Page, base: string, module: string, canvas: string;
    beforeAll(async () => {
      [base, module, canvas] = await Promise.all(
        ['index', 'input', 'canvas'].map((n) =>
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
        '<anima-icon motion="full" style="display:block;width:200px;height:100px"></anima-icon>',
      );
      await page.addScriptTag({ type: 'module', content: base });
      await page.waitForFunction(() => !!customElements.get('anima-icon'));
      await page.addScriptTag({ type: 'module', content: module });
      await page.waitForFunction(() => !!document.querySelector('anima-icon')!.input);
      await page.evaluate((d) => document.querySelector('anima-icon')!.load(d), doc);
    });
    afterEach(async () => page.close());
    it('maps client positions through the actual SVG viewport matrix', async () => {
      const r = await page.evaluate(() => {
        const i = document.querySelector('anima-icon')!,
          b = i.getBoundingClientRect();
        return i.inputPoint(b.x + b.width / 2, b.y + b.height / 2).toJSON();
      });
      expect(r.x).toBeCloseTo(10, 5);
      expect(r.y).toBeCloseTo(10, 5);
    });
    it.each(['contain', 'cover', 'fill', 'none'])(
      'maps fit %s under non-square bounds and corner alignment',
      async (fit) => {
        const r = await page.evaluate((fit) => {
          const i = document.querySelector('anima-icon')!;
          i.setAttribute('fit', fit);
          i.setAttribute('align', 'bottom-right');
          const svg = i.shadowRoot!.querySelector('svg')!,
            m = svg.getScreenCTM()!,
            screen = new DOMPoint(7, 13).matrixTransform(m),
            local = i.inputPoint(screen.x, screen.y);
          return { x: local.x, y: local.y };
        }, fit);
        expect(r.x).toBeCloseTo(7, 5);
        expect(r.y).toBeCloseTo(13, 5);
      },
    );
    it('receives real mouse input once and drags outside the original hit area', async () => {
      const b = (await page.locator('anima-icon').boundingBox())!;
      await page.mouse.move(b.x + 100, b.y + 50);
      await page.mouse.down();
      await page.mouse.move(b.x + 190, b.y + 80);
      await page.mouse.up();
      const r = await page.evaluate(() => {
        const i = document.querySelector('anima-icon')!;
        return { down: i.get('down'), up: i.get('up'), x: i.get('x'), y: i.get('y') };
      });
      expect(r).toMatchObject({ down: true, up: true });
      expect(r.x).toBeCloseTo(28, 5);
      expect(r.y).toBeCloseTo(16, 5);
    });
    it('routes synthetic secondary and middle buttons without duplicating base handlers', async () => {
      const r = await page.evaluate((d) => {
        const i = document.querySelector('anima-icon')!;
        i.load({
          ...d,
          listeners: [
            { on: 'down', button: 1, set: { down: true } },
            { on: 'down', button: 2, set: { up: true } },
          ],
        });
        const b = i.getBoundingClientRect();
        for (const button of [1, 2])
          i.dispatchEvent(
            new PointerEvent('pointerdown', {
              bubbles: true,
              pointerId: button,
              clientX: b.x + 100,
              clientY: b.y + 50,
              button,
            }),
          );
        return [i.get('down'), i.get('up')];
      }, doc);
      expect(r).toEqual([true, true]);
    });
    it.each(['pointerleave', 'pointercancel'] as const)(
      'routes %s once through input while letting it reach page listeners',
      async (type) => {
        const result = await page.evaluate((type) => {
          const icon = document.querySelector('anima-icon')!;
          const controller = icon.input();
          const pointer = controller.pointer;
          const calls: string[] = [];
          let bubbled = 0;
          controller.pointer = function (...args) {
            calls.push(args[0]);
            return pointer.apply(this, args);
          };
          document.body.addEventListener(type, () => bubbled++);
          icon.dispatchEvent(new PointerEvent(type, { pointerId: 7, bubbles: true }));
          return { calls, bubbled };
        }, type);
        expect(result).toEqual({
          calls: [type === 'pointerleave' ? 'leave' : 'cancel'],
          bubbled: 1,
        });
      },
    );
    it('disabled automatic input still bubbles unconsumed keys and pointer events', async () => {
      const result = await page.evaluate(() => {
        const icon = document.querySelector('anima-icon')!;
        icon.inputOptions = { listeners: false };
        const events: [string, boolean][] = [];
        for (const type of ['keydown', 'keyup', 'pointerdown', 'pointermove', 'pointerup'])
          document.body.addEventListener(type, (e) => events.push([e.type, e.defaultPrevented]));
        for (const type of ['keydown', 'keyup'])
          icon.dispatchEvent(
            new KeyboardEvent(type, { key: 'Escape', bubbles: true, cancelable: true }),
          );
        const b = icon.getBoundingClientRect();
        for (const type of ['pointerdown', 'pointermove', 'pointerup'])
          icon.dispatchEvent(
            new PointerEvent(type, {
              clientX: b.x + 100,
              clientY: b.y + 50,
              pointerId: 7,
              bubbles: true,
              cancelable: true,
            }),
          );
        return { events, down: icon.get('down'), up: icon.get('up') };
      });
      expect(result).toEqual({
        events: [
          ['keydown', false],
          ['keyup', false],
          ['pointerdown', false],
          ['pointermove', false],
          ['pointerup', false],
        ],
        down: false,
        up: false,
      });
    });
    it('keeps multiple pointer IDs and cancels a contact at its last position', async () => {
      const r = await page.evaluate(() => {
        const i = document.querySelector('anima-icon')!,
          b = i.getBoundingClientRect();
        for (const id of [11, 12])
          i.dispatchEvent(
            new PointerEvent('pointerdown', {
              bubbles: true,
              pointerId: id,
              pointerType: 'touch',
              isPrimary: id === 11,
              clientX: b.x + 100,
              clientY: b.y + 50,
            }),
          );
        const before = i.input().contacts.size;
        i.dispatchEvent(
          new PointerEvent('pointercancel', { bubbles: true, pointerId: 11, pointerType: 'touch' }),
        );
        return { before, remaining: [...i.input().contacts.keys()] };
      });
      expect(r).toEqual({ before: 2, remaining: [12] });
    });
    it('lets hosts disable automatic listeners and choose touch page scrolling', async () => {
      const r = await page.evaluate(() => {
        const i = document.querySelector('anima-icon')!;
        i.inputOptions = { ...i.inputOptions, listeners: false, touchScroll: false };
        i.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            pointerId: 1,
            clientX: 108,
            clientY: 58,
          }),
        );
        return { down: i.get('down'), touch: i.style.touchAction, options: i.inputOptions };
      });
      expect(r).toMatchObject({
        down: false,
        touch: 'none',
        options: { listeners: false, touchScroll: false },
      });
    });
    it('keeps manual host input available when automatic DOM listeners are disabled', async () => {
      const r = await page.evaluate(() => {
        const i = document.querySelector('anima-icon')!;
        i.inputOptions = { listeners: false };
        i.inputPointer('down', 10, 10, { id: 7 });
        return i.get('down');
      });
      expect(r).toBe(true);
    });
    it('limits multitouch and optionally retains contacts across pointer exit', async () => {
      const r = await page.evaluate(() => {
        const i = document.querySelector('anima-icon')!,
          b = i.getBoundingClientRect();
        i.inputOptions = { ...i.inputOptions, multitouch: false, pointerExit: false };
        for (const [id, primary] of [
          [11, true],
          [12, false],
        ] as const)
          i.dispatchEvent(
            new PointerEvent('pointerdown', {
              bubbles: true,
              pointerId: id,
              isPrimary: primary,
              clientX: b.x + 100,
              clientY: b.y + 50,
            }),
          );
        i.dispatchEvent(new PointerEvent('pointerleave', { pointerId: 11 }));
        return [...i.input().contacts.keys()];
      });
      expect(r).toEqual([11]);
    });
    it('routes exact key modifiers without requiring a button accessibility role', async () => {
      const r = await page.evaluate(() => {
        const i = document.querySelector('anima-icon')!;
        i.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
        return i.get('key');
      });
      expect(r).toBe(true);
    });
    it('retains native Enter and Space accessibility activation', async () => {
      const r = await page.evaluate((d) => {
        const i = document.querySelector('anima-icon')!;
        i.load({
          ...d,
          a11y: { role: 'switch', label: 'Toggle', activate: 'pressed', pressed: 'pressed' },
        });
        i.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
        );
        const enter = i.get('pressed');
        i.dispatchEvent(
          new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
        );
        const spaceDown = i.get('pressed');
        i.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
        return { enter, spaceDown, spaceUp: i.get('pressed') };
      }, doc);
      expect(r).toEqual({ enter: true, spaceDown: true, spaceUp: false });
    });
    it('consumes wheel only when a scroll listener hits or a gesture is latched', async () => {
      const r = await page.evaluate(() => {
        const i = document.querySelector('anima-icon')!,
          b = i.getBoundingClientRect();
        const wheel = (x: number, y: number, deltaY: number) => {
          const e = new WheelEvent('wheel', {
            clientX: b.x + x,
            clientY: b.y + y,
            deltaY,
            bubbles: true,
            cancelable: true,
          });
          i.dispatchEvent(e);
          return e.defaultPrevented;
        };
        const outside = wheel(0, 0, 2),
          inside = wheel(100, 50, 0.125),
          latched = wheel(0, 0, 0.25);
        return { outside, inside, latched, value: i.get('scroll') };
      });
      expect(r).toEqual({ outside: false, inside: true, latched: true, value: 0.25 });
    });
    it.each(['arrow', 'hidden', 'pointer', 'resize-horizontal', 'resize-vertical', 'text'])(
      'applies cursor intent %s',
      async (cursor) => {
        const r = await page.evaluate(
          ({ d, cursor }) => {
            const i = document.querySelector('anima-icon')!;
            i.load({ ...d, nodes: [{ ...d.nodes[0], cursor }] });
            const b = i.getBoundingClientRect();
            i.dispatchEvent(
              new PointerEvent('pointermove', {
                bubbles: true,
                pointerId: 1,
                clientX: b.x + 100,
                clientY: b.y + 50,
              }),
            );
            return i.style.cursor;
          },
          { d: doc, cursor },
        );
        expect(r).toBe(
          {
            arrow: 'default',
            hidden: 'none',
            pointer: 'pointer',
            'resize-horizontal': 'ew-resize',
            'resize-vertical': 'ns-resize',
            text: 'text',
          }[cursor],
        );
      },
    );
    it('polls browser gamepads on opt-in and requires focus by default', async () => {
      await page.evaluate((d) => {
        const i = document.querySelector('anima-icon')!;
        i.load({ ...d, listeners: [{ on: 'gamepad-axis', control: 0, write: { value: 'x' } }] });
        Object.defineProperty(navigator, 'getGamepads', {
          configurable: true,
          value: () => [
            { index: 0, connected: true, mapping: 'standard', axes: [0.625], buttons: [] },
          ],
        });
        i.tabIndex = 0;
        i.inputOptions = { ...i.inputOptions, gamepads: true };
      }, doc);
      await page.waitForTimeout(50);
      expect(await page.evaluate(() => document.querySelector('anima-icon')!.get('x'))).toBe(0);
      await page.locator('anima-icon').focus();
      await expect
        .poll(() => page.evaluate(() => document.querySelector('anima-icon')!.get('x')))
        .toBe(0.625);
      await page.evaluate(() => {
        const i = document.querySelector('anima-icon')!;
        i.inputOptions = { ...i.inputOptions, gamepads: false };
      });
    });
    it('offers host hit tests and inverse mapping with the canvas backend', async () => {
      await page.addScriptTag({ type: 'module', content: canvas });
      await page.waitForFunction(
        () =>
          !!(customElements.get('anima-icon') as { renderers?: Record<string, unknown> }).renderers
            ?.canvas,
      );
      const r = await page.evaluate(() => {
        const i = document.querySelector('anima-icon')!;
        i.setAttribute('renderer', 'canvas');
        const b = i.getBoundingClientRect(),
          p = i.inputPoint(b.x + 100, b.y + 50);
        return { x: p.x, y: p.y, hit: i.input().hitTest(p.x, p.y) };
      });
      expect(r).toEqual({ x: 10, y: 10, hit: ['disc', '@icon'] });
    });
    it.each(['contain', 'cover', 'fill', 'none'])(
      'keeps canvas input mapping aligned with SVG for a bleeding viewBox and fit %s',
      async (fit) => {
        await page.addScriptTag({ type: 'module', content: canvas });
        await page.waitForFunction(
          () =>
            !!(customElements.get('anima-icon') as { renderers?: Record<string, unknown> })
              .renderers?.canvas,
        );
        const r = await page.evaluate(
          ({ d, fit }) => {
            const i = document.querySelector('anima-icon')!;
            i.load({ ...d, viewBox: [-2, -4, 24, 28] });
            i.setAttribute('fit', fit);
            i.setAttribute('align', 'bottom-right');
            const m = i.shadowRoot!.querySelector('svg')!.getScreenCTM()!,
              client = new DOMPoint(7, 13).matrixTransform(m);
            i.setAttribute('renderer', 'canvas');
            const mapped = i.inputPoint(client.x, client.y);
            return { x: mapped.x, y: mapped.y };
          },
          { d: doc, fit },
        );
        expect(r.x).toBeCloseTo(7, 5);
        expect(r.y).toBeCloseTo(13, 5);
      },
    );
    it('tears down and reloads without retaining the previous contact state', async () => {
      const r = await page.evaluate((d) => {
        const i = document.querySelector('anima-icon')!;
        i.input().pointer('down', 10, 10, { id: 7 });
        const old = i.input();
        i.destroy();
        i.load(d);
        return { old: old.contacts.size, current: i.input().contacts.size };
      }, doc);
      expect(r).toEqual({ old: 0, current: 0 });
    });
    it('leaves legacy documents on the original pointer and keyboard path', async () => {
      await page.evaluate((d) => {
        document.querySelector('anima-icon')!.load({
          ...d,
          requires: [],
          nodes: [{ id: 'disc', type: 'circle', center: [10, 10], r: 8, fill: { color: '#000' } }],
          listeners: [{ on: 'down', set: { down: true } }],
        });
      }, doc);
      const b = (await page.locator('anima-icon').boundingBox())!;
      await page.mouse.move(b.x + 100, b.y + 50);
      await page.mouse.down();
      await page.mouse.up();
      expect(await page.evaluate(() => document.querySelector('anima-icon')!.get('down'))).toBe(
        true,
      );
    });
  });
