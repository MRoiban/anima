// Rottweiler P6 regressions (design/rottweiler/P6-LEDGER.md).
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import { testFont } from '../font.ts';
import { testFont as kernedFont } from '../../../../tools/test-font.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../web/index.ts';
for (const [name, browserType, executablePath] of [
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
    `${name}: R1-09 with the text consumer, reconnecting a host restores its named font faces; a reload does not`,
    async () => {
      const browser = await browserType.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent('<anima-icon paused></anima-icon>');
        for (const entry of ['assets', 'fonts', 'fonts-text'])
          await page.addScriptTag({
            type: 'module',
            content: await bundle(resolve('packages/web/src/' + entry + '.ts')),
          });
        await page.waitForFunction(
          () =>
            !!Object.getOwnPropertyDescriptor(
              (customElements.get('anima-icon') as typeof AnimaIcon).prototype,
              'fonts',
            ),
        );
        const result = await page.evaluate(
          async (bytes) => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            const doc = (asset: boolean) => ({
              anima: '0.1',
              name: 'fonts',
              grid: 20,
              requires: ['assets', 'fonts'],
              assets: asset
                ? {
                    test: {
                      type: 'font',
                      source: 'data:font/ttf;base64,' + btoa(String.fromCharCode(...bytes)),
                    },
                  }
                : {},
              nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
            });
            const load = (d: object) =>
              new Promise<void>((res) => {
                icon.addEventListener('anima:load', () => res(), { once: true });
                icon.load(d);
              });
            const spec = {
              family: 'test',
              size: 10,
              weight: 400,
              style: 'normal' as const,
              tracking: 0,
            };
            const state = () => [icon.fonts.cssFont(spec).fontFamily, document.fonts.size];
            await load(doc(true));
            const loaded = state();
            icon.remove();
            const detached = document.fonts.size;
            document.body.append(icon);
            const reconnected = state();
            // Two disconnects without a font use in between keep the first snapshot.
            icon.remove();
            document.body.append(icon);
            icon.remove();
            document.body.append(icon);
            const twice = state();
            await load(doc(false));
            return { loaded, detached, reconnected, twice, reloaded: state() };
          },
          [...testFont()],
        );
        expect(result.loaded).toEqual([expect.stringMatching(/^"anima-font-\d+"$/), 1]);
        expect(result.detached).toBe(0);
        expect(result.reconnected).toEqual(result.loaded);
        expect(result.twice).toEqual(result.loaded);
        expect(result.reloaded).toEqual(['test', 0]);
      } finally {
        await browser.close();
      }
    },
    30000,
  );
  it.skipIf(!existsSync(executablePath))(
    `${name}: R2-06 a reconnect restores a child scope's host fallback faces`,
    async () => {
      const browser = await browserType.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent('<anima-icon paused></anima-icon>');
        for (const entry of ['assets', 'components', 'fonts', 'fonts-text'])
          await page.addScriptTag({
            type: 'module',
            content: await bundle(resolve('packages/web/src/' + entry + '.ts')),
          });
        await page.waitForFunction(
          () => !!(customElements.get('anima-icon') as typeof AnimaIcon).modules.has('components'),
        );
        const result = await page.evaluate(
          async (bytes) => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            await new Promise((res) => {
              icon.addEventListener('anima:load', res, { once: true });
              icon.load({
                anima: '0.1',
                name: 'child-fallback',
                grid: 20,
                requires: ['assets', 'components', 'fonts'],
                components: {
                  child: {
                    grid: 20,
                    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
                  },
                },
                nodes: [{ id: 'i', type: 'instance', component: 'child' }],
              });
            });
            const child = (
              icon.player!.nested as unknown as { players: Map<string, { model: object }> }
            ).players.get('i')!;
            const scope = icon.fonts.forModel(child.model as never);
            await scope.add(await new FontFace('fallback-child', new Uint8Array(bytes)).load());
            const spec = {
              family: 'missing',
              size: 10,
              weight: 400,
              style: 'normal' as const,
              tracking: 0,
            };
            const before = icon.fonts.forModel(child.model as never).cssFont(spec).fontFamily;
            icon.remove();
            document.body.append(icon);
            return [before, icon.fonts.forModel(child.model as never).cssFont(spec).fontFamily];
          },
          [...testFont()],
        );
        expect(result).toEqual(['missing, "fallback-child"', 'missing, "fallback-child"']);
      } finally {
        await browser.close();
      }
    },
    30000,
  );
  it.skipIf(!existsSync(executablePath))(
    `${name}: P7 R2-5 replacing a named font releases the superseded face unless another name uses it`,
    async () => {
      const browser = await browserType.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent('<anima-icon paused></anima-icon>');
        for (const entry of ['assets', 'fonts'])
          await page.addScriptTag({
            type: 'module',
            content: await bundle(resolve('packages/web/src/' + entry + '.ts')),
          });
        await page.waitForFunction(
          () =>
            !!Object.getOwnPropertyDescriptor(
              (customElements.get('anima-icon') as typeof AnimaIcon).prototype,
              'fonts',
            ),
        );
        const result = await page.evaluate(
          async (bytes) => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            const data = () => new Uint8Array(bytes).buffer;
            const sizes: number[] = [];
            for (let i = 0; i < 3; i++) {
              await icon.fonts.set('body', data());
              sizes.push(document.fonts.size);
            }
            // One face under two names survives replacing one of them.
            const shared = await new FontFace('shared', data()).load();
            await icon.fonts.set('a', shared);
            await icon.fonts.set('b', shared);
            await icon.fonts.set('a', data());
            const kept = document.fonts.has(shared);
            await icon.fonts.set('b', data());
            return {
              sizes,
              kept,
              released: !document.fonts.has(shared),
              total: document.fonts.size,
            };
          },
          [...testFont()],
        );
        expect(result).toEqual({ sizes: [1, 1, 1], kept: true, released: true, total: 3 });
      } finally {
        await browser.close();
      }
    },
    30000,
  );
  it.skipIf(!existsSync(executablePath))(
    `${name}: R4-01 a font load keeps the options-aware measurer (kern:0 stays unkerned)`,
    async () => {
      const browser = await browserType.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.route('http://font.test/late.ttf', (r) =>
          r.fulfill({
            body: kernedFont(),
            headers: { 'access-control-allow-origin': '*', 'content-type': 'font/ttf' },
          }),
        );
        await page.setContent('<anima-icon paused></anima-icon>');
        for (const entry of ['fonts-options'])
          await page.addScriptTag({
            type: 'module',
            content: await bundle(resolve('packages/web/src/' + entry + '.ts')),
          });
        await page.waitForFunction(
          () => !!(customElements.get('anima-icon') as typeof AnimaIcon).modules.get('text'),
        );
        const widths = await page.evaluate(
          async (bytes) => {
            document.fonts.add(await new FontFace('Kerned', new Uint8Array(bytes)).load());
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            const diagnostics = icon.load({
              anima: '0.1',
              name: 'kern-off',
              grid: 20,
              requires: ['text', 'fonts'],
              nodes: [
                {
                  id: 't',
                  type: 'text',
                  styles: { s: { font: 'Kerned', size: 20, features: { kern: 0 } } },
                  runs: [{ text: 'AV', style: 's' }],
                },
              ],
            });
            const text = (customElements.get('anima-icon') as typeof AnimaIcon).modules.get(
              'text',
            ) as unknown as { textLayout(p: unknown, i: number): { width: number } };
            if (!icon.player) return diagnostics;
            // Font readiness gates layout: wait for a measured width each time.
            const settled = async () => {
              for (let i = 0; i < 100; i++) {
                const width = text.textLayout(icon.player, 0).width;
                if (width) return width;
                await new Promise((r) => setTimeout(r, 20));
              }
              return 0;
            };
            const before = await settled();
            // A real, unrelated font load fires loadingdone.
            document.fonts.add(new FontFace('Unrelated', 'url(http://font.test/late.ttf)'));
            await document.fonts.load('20px Unrelated', 'AV');
            await new Promise((r) => setTimeout(r, 100));
            return [before, await settled()];
          },
          [...kernedFont()],
        );
        expect(widths).toHaveLength(2);
        expect((widths as number[])[0]).toBeGreaterThan(0);
        expect((widths as number[])[1]).toBe((widths as number[])[0]);
      } finally {
        await browser.close();
      }
    },
    30000,
  );
  it.skipIf(!existsSync(executablePath))(
    `${name}: R5-01 with fonts-options, a late CSS font relayouts root and nested text alike`,
    async () => {
      const browser = await browserType.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.route('http://font.test/late.ttf', (r) =>
          r.fulfill({
            body: Buffer.from(kernedFont()),
            headers: { 'access-control-allow-origin': '*', 'content-type': 'font/ttf' },
          }),
        );
        await page.setContent('<anima-icon paused></anima-icon>');
        for (const entry of ['text', 'components', 'fonts-options'])
          await page.addScriptTag({
            type: 'module',
            content: await bundle(resolve('packages/web/src/' + entry + '.ts')),
          });
        await page.waitForFunction(
          () => !!(customElements.get('anima-icon') as typeof AnimaIcon).modules.has('fonts'),
        );
        const widths = () =>
          page.evaluate(() => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            const text = (customElements.get('anima-icon') as typeof AnimaIcon).modules.get(
              'text',
            ) as unknown as { textLayout(p: unknown, i: number): { width: number } };
            const child = (
              icon.player!.nested as unknown as { players: Map<string, unknown> }
            ).players.get('i');
            return [text.textLayout(icon.player, 0).width, text.textLayout(child, 0).width];
          });
        await page.evaluate(async () => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const label = {
            id: 't',
            type: 'text',
            runs: [{ text: 'AV', style: 's' }],
            styles: { s: { font: 'Late, monospace', size: 10 } },
          };
          icon.load({
            anima: '0.1',
            name: 'late',
            grid: 20,
            requires: ['components', 'text', 'fonts'],
            components: { child: { grid: 20, nodes: [label] } },
            nodes: [label, { id: 'i', type: 'instance', component: 'child' }],
          });
          for (let i = 0; i < 100 && !icon.player; i++) await new Promise((r) => setTimeout(r, 20));
        });
        await expect.poll(async () => (await widths())[0], { timeout: 5000 }).toBeGreaterThan(0);
        const before = await widths();
        await page.evaluate(async () => {
          document.fonts.add(new FontFace('Late', 'url(http://font.test/late.ttf)'));
          await document.fonts.load('10px Late', 'AV');
        });
        await expect
          .poll(
            async () => {
              const [root, child] = await widths();
              return root !== before[0] && root === child;
            },
            { timeout: 5000 },
          )
          .toBe(true);
      } finally {
        await browser.close();
      }
    },
    30000,
  );
}
