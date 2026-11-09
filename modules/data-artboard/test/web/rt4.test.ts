import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
const engines = [
  [
    'Chromium',
    chromium,
    '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['Firefox', firefox, '.cache/ms-playwright/firefox-1555/firefox/firefox'],
] as const;
const entry = (name: string) => cachedBundle(resolve('packages/web/src/' + name + '.ts'));
async function withPage(
  engine: (typeof engines)[number][1],
  executable: string,
  run: (page: import('playwright-core').Page, errors: string[]) => Promise<void>,
) {
  const executablePath = [resolve(homedir(), executable), engine.executablePath()].find(existsSync);
  const browser = await engine.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await run(page, errors);
  } finally {
    await browser.close();
  }
}
// A separately bundled second copy of an entry: identical code, a distinct module script.
const again = async (page: import('playwright-core').Page, name: string) =>
  page.addScriptTag({ type: 'module', content: (await entry(name)) + '\n// second bundle' });
declare global {
  interface Window {
    rt4: { doc: object; value: unknown };
  }
}
const names = ['data-artboard-values', 'components', 'data', 'host', 'assets', 'paint'];
for (const [name, engine, executable] of engines)
  it(`${name}: R4-2 a second data-artboard bundle keeps acquired values' resources`, async () => {
    await withPage(engine, executable, async (page, errors) => {
      await page.setContent(
        '<base href="https://example.test/"><anima-icon id="source" paused auto-bind></anima-icon><anima-icon id="target" paused auto-bind></anima-icon>',
      );
      for (const n of names) await page.addScriptTag({ type: 'module', content: await entry(n) });
      await page.addScriptTag({ type: 'module', content: await entry('data-artboard') });
      await page.waitForFunction(() => !!document.querySelector('anima-icon')!.component);
      await page.evaluate(async () => {
        const i = document.querySelector('#source') as AnimaIcon;
        const doc = {
          anima: '0.1',
          name: 'resource-source',
          grid: 20,
          requires: ['assets', 'paint', 'components', 'data', 'nested', 'host', 'dataartboard'],
          data: {
            models: { Card: { properties: { content: { type: 'artboard', default: '' } } } },
          },
          assets: { tile: { type: 'image', source: 'tile.svg' } },
          components: {
            leaf: {
              grid: 20,
              nodes: [
                { id: 'photo', type: 'image', asset: 'tile', x0: 0, y0: 0, width: 5, height: 5 },
              ],
            },
          },
          nodes: [{ id: 'empty', type: 'group', children: [] }],
        };
        (i as unknown as { assets: () => Blob }).assets = () =>
          new Blob(
            [
              '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><path fill="red" d="M0 0H2V2H0Z"/></svg>',
            ],
            {
              type: 'image/svg+xml',
            },
          );
        i.load(doc);
        await i.ready;
        window.rt4 = { doc, value: i.component(i.player!.model, 'leaf') };
      });
      await again(page, 'data-artboard');
      const result = await page.evaluate(async () => {
        const i = document.querySelector('#target') as AnimaIcon,
          s = document.querySelector('#source') as AnimaIcon;
        // The destination's own resolver supplies a different (blue) tile.
        (i as unknown as { assets: () => Blob }).assets = () =>
          new Blob(
            [
              '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><path fill="blue" d="M0 0H2V2H0Z"/></svg>',
            ],
            { type: 'image/svg+xml' },
          );
        i.load({
          ...window.rt4.doc,
          name: 'dest',
          nodes: [{ id: 'slot', type: 'instance', component: '$content' }],
        });
        await i.ready;
        i.data.artboard('content').set(window.rt4.value as never);
        i.player!.step(0);
        i.invalidate();
        const assets = (customElements.get('anima-icon') as typeof AnimaIcon).modules.get(
          'assets',
        ) as unknown as {
          resolvedAssets: WeakMap<object, Record<string, { source: string }>>;
        };
        return {
          href: i.shadowRoot!.querySelector('image')?.getAttribute('href'),
          source: assets.resolvedAssets.get(s.player!)?.tile?.source,
        };
      });
      expect(errors).toEqual([]);
      expect(result.href).toMatch(/^data:image\/svg\+xml/);
      expect(result.href).toBe(result.source);
    });
  }, 30_000);
