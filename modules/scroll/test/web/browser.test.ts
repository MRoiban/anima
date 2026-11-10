import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type {} from '../../web/index.ts';

const root = new URL('../../../../', import.meta.url);
const doc = {
  anima: '0.1',
  name: 'scroll-browser',
  grid: 20,
  requires: ['rig', 'input', 'scroll'],
  nodes: [
    { id: 'viewport', type: 'rect', x0: 0, y0: 0, w: 10, h: 10, fill: { color: '#eee' } },
    {
      id: 'content',
      type: 'group',
      constraints: [{ kind: 'scroll', viewport: 'viewport', axis: 'y' }],
      children: [{ id: 'body', type: 'rect', x0: 0, y0: 0, w: 10, h: 30, fill: { color: '#000' } }],
    },
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
  describe.skipIf(!existsSync(executablePath))(`scroll browser ${name}`, () => {
    let browser: Browser, page: Page;
    beforeAll(async () => {
      const scripts = await Promise.all(
        ['all-modules'].map((n) => bundle(new URL(`packages/web/src/${n}.ts`, root).pathname)),
      );
      browser = await engine.launch({
        executablePath,
        headless: true,
        args: name === 'Chromium' ? ['--no-sandbox'] : [],
      });
      (globalThis as { __scrollScripts?: string[] }).__scrollScripts = scripts;
    }, 120000);
    afterAll(async () => browser?.close());
    beforeEach(async () => {
      page = await browser.newPage();
      await page.setContent(
        '<anima-icon style="display:block;width:240px;height:240px"></anima-icon>',
      );
      for (const script of (globalThis as { __scrollScripts?: string[] }).__scrollScripts!)
        await page.addScriptTag({ type: 'module', content: script });
      await page.waitForFunction(() => !!customElements.get('anima-icon'));
      await page.evaluate(async (d) => {
        const icon = document.querySelector('anima-icon')!;
        icon.setAttribute('paused', '');
        icon.load(d);
        try {
          await icon.ready;
        } catch (error) {
          throw new Error(JSON.stringify(error), { cause: error });
        }
      }, doc);
    });
    afterEach(async () => page.close());

    it('prevents wheel only while the clamped offset moves', async () => {
      const result = await page.evaluate(() => {
        const icon = document.querySelector('anima-icon')!,
          b = icon.getBoundingClientRect(),
          screen = (x: number, y: number) => {
            const p0 = icon.inputPoint(b.left, b.top),
              px = icon.inputPoint(b.left + 1, b.top),
              py = icon.inputPoint(b.left, b.top + 1),
              ax = px.x - p0.x,
              ay = px.y - p0.y,
              bx = py.x - p0.x,
              by = py.y - p0.y,
              det = ax * by - ay * bx,
              lx = x - p0.x,
              ly = y - p0.y;
            return {
              x: b.left + (lx * by - ly * bx) / det,
              y: b.top + (ax * ly - ay * lx) / det,
            };
          },
          point = screen(5, 5),
          wheel = (deltaY: number) => {
            const event = new WheelEvent('wheel', {
              clientX: point.x,
              clientY: point.y,
              deltaY,
              bubbles: true,
              cancelable: true,
            });
            icon.dispatchEvent(event);
            icon.player!.step(0);
            return {
              prevented: event.defaultPrevented,
              y: icon.player!.values()['content.world.y'],
            };
          };
        return { moving: wheel(30), atEnd: wheel(1) };
      });
      expect(result).toEqual({
        moving: { prevented: true, y: -20 },
        atEnd: { prevented: false, y: -20 },
      });
    }, 30000);

    it('queues viewport dragging and applies it on the next step', async () => {
      const result = await page.evaluate(() => {
        const icon = document.querySelector('anima-icon')!,
          b = icon.getBoundingClientRect(),
          screen = (x: number, y: number) => {
            const p0 = icon.inputPoint(b.left, b.top),
              px = icon.inputPoint(b.left + 1, b.top),
              py = icon.inputPoint(b.left, b.top + 1),
              ax = px.x - p0.x,
              ay = px.y - p0.y,
              bx = py.x - p0.x,
              by = py.y - p0.y,
              det = ax * by - ay * bx,
              lx = x - p0.x,
              ly = y - p0.y;
            return {
              x: b.left + (lx * by - ly * bx) / det,
              y: b.top + (ax * ly - ay * lx) / det,
            };
          },
          p0 = screen(5, 1),
          p1 = screen(5, 6),
          fire = (kind: string, p: { x: number; y: number }) =>
            icon.dispatchEvent(
              new PointerEvent(kind, {
                pointerId: 7,
                button: 0,
                clientX: p.x,
                clientY: p.y,
                bubbles: true,
                cancelable: true,
              }),
            );
        fire('pointerdown', p0);
        fire('pointermove', p1);
        const queued = icon.player!.values()['content.world.y'];
        icon.player!.step(0);
        return { queued, stepped: icon.player!.values()['content.world.y'] };
      });
      expect(result.queued).toBe(0);
      expect(result.stepped).toBeCloseTo(-5, 8);
    }, 30000);
  });
