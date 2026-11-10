import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { describe, it, expect } from 'vitest';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';

for (const [name, engine, paths] of [
  [
    'Chromium',
    chromium,
    [
      process.env.CHROMIUM_PATH,
      resolve(
        homedir(),
        '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
      ),
      chromium.executablePath(),
    ],
  ],
  [
    'Firefox',
    firefox,
    [
      process.env.FIREFOX_PATH,
      resolve(homedir(), '.cache/ms-playwright/firefox-1555/firefox/firefox'),
      firefox.executablePath(),
    ],
  ],
] as const)
  describe(name + ' bind', () => {
    it('a separate module wakes a settled ring and applies input on exactly the next frame', async () => {
      const executablePath = paths.find((p) => p && existsSync(p));
      if (!executablePath) throw Error('browser absent');
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        const js = await bundle(resolve('packages/web/src/index.ts'));
        const paint = await bundle(resolve('packages/web/src/paint.ts'));
        const binding = await bundle(resolve('packages/web/src/bind.ts'));
        await page.setContent(
          '<anima-icon style="display:block;width:200px;height:200px"></anima-icon>',
        );
        await page.evaluate(() => {
          let queue: FrameRequestCallback[] = [],
            now = 0;
          window.requestAnimationFrame = (cb) => queue.push(cb);
          performance.now = () => now;
          (window as unknown as { tick(): void }).tick = () => {
            now += 16;
            const callbacks = queue;
            queue = [];
            callbacks.forEach((cb) => cb(now));
          };
        });
        await page.addScriptTag({ type: 'module', content: js });
        await page.evaluate(() => customElements.whenDefined('anima-icon'));
        await page.addScriptTag({ type: 'module', content: paint });
        await page.addScriptTag({ type: 'module', content: binding });
        // Registration must not poll the fake rAF clock, which is intentionally not ticking yet.
        await page.waitForFunction(
          () => (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('bind'),
          undefined,
          { polling: 10 },
        );
        await page.waitForFunction(
          () => (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('paint'),
          undefined,
          { polling: 10 },
        );
        await page.evaluate(async () => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          await icon.load({
            anima: '0.1',
            name: 'bound',
            grid: 20,
            requires: ['bind', 'paint'],
            inputs: { progress: { type: 'number', default: 0, min: 0, max: 1 } },
            nodes: [
              {
                id: 'ring',
                type: 'circle',
                center: [10, 10],
                r: 8,
                stroke: { color: '#000', trimEnd: 0 },
              },
            ],
            bind: { 'ring.stroke.trimEnd': 'progress', 'ring.stroke.dashOffset': 'progress * 2' },
          });
        });
        const result = await page.evaluate(() => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const tick = () => (window as unknown as { tick(): void }).tick();
          tick();
          tick();
          const before = icon.player!.value('ring.stroke.trimEnd');
          icon.set('progress', 0.625);
          const queued = icon.player!.value('ring.stroke.trimEnd');
          tick();
          const after = icon.player!.value('ring.stroke.trimEnd');
          if (icon.player!.value('ring.stroke.dashOffset') !== 1.25)
            throw Error('shared module address resolution failed');
          const dash = icon.shadowRoot!.querySelector('circle')!.getAttribute('stroke-dasharray');
          tick();
          return { before, queued, after, dash, busy: icon.player!.busy };
        });
        expect(result).toEqual({
          before: 0,
          queued: 0,
          after: 0.625,
          dash: '31.41593 100.53096',
          busy: false,
        });
        // Exercise the string branch in the shipped, terse browser bundle as well.
        const strings = await page.evaluate(async () => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          await icon.load({
            anima: '0.1',
            name: 'string-bindings',
            grid: 20,
            requires: ['bind'],
            inputs: { shown: { type: 'bool', default: true } },
            nodes: [{ id: 'row', type: 'circle', center: [10, 10], r: 1 }],
            bind: {
              'row.visible': 'shown and contains(lower("SOUND"), "so")',
              'row.x': 'lower("İ") == "i̇" and contains("", "")',
            },
          });
          const tick = () => (window as unknown as { tick(): void }).tick();
          tick();
          const before = icon.player!.value('row.visible');
          const x = icon.player!.value('row.x');
          icon.set('shown', false);
          tick();
          return { before, x, after: icon.player!.value('row.visible') };
        });
        expect(strings).toEqual({ before: true, x: 1, after: false });
      } finally {
        await browser.close();
      }
    }, 30000);
  });
