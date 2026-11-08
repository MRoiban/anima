import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Page } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../web/index.ts';
import type {} from '../../../host/web/index.ts';

async function add(page: Page, name: string) {
  await page.addScriptTag({
    type: 'module',
    content: await cachedBundle(resolve('packages/web/src/' + name + '.ts')),
  });
  await page.waitForFunction(
    (name) => {
      const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
      return name === 'index'
        ? !!Icon
        : name === 'markup-hooks'
          ? !!Icon.compiler
          : Icon.modules.has(name === 'host-edit' ? 'hostedit' : name);
    },
    name,
    { polling: 10 },
  );
}
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
  describe(name + ' BF-3', () => {
    it('B9 bounds source caches, invalidates on registration, and shares concurrent inline AniML compilation', async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await add(page, 'index');
        const result = await page.evaluate(async () => {
          const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
          let compiles = 0,
            authored = 0;
          Icon.registerModule({
            name: 'probe',
            entries: [],
            load() {
              compiles++;
            },
          });
          const doc = {
            anima: '0.1',
            name: 'cache',
            grid: 20,
            nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
          };
          const text = JSON.stringify(doc);
          const icons: AnimaIcon[] = [];
          const create = () => {
            const icon = document.createElement('anima-icon');
            icon.pause();
            document.body.append(icon);
            icons.push(icon);
            return icon;
          };
          create().load(doc);
          create().load(doc);
          const objectCompiles = compiles;
          create().load(text);
          create().load(text);
          const textCompiles = compiles - objectCompiles;
          Icon.refresh();
          create().load(doc);
          const refreshed = compiles - objectCompiles - textCompiles;
          for (let i = 0; i < 17; i++) create().load(JSON.stringify({ ...doc, meta: { i } }));
          const prior = compiles;
          create().load(text);
          const evicted = compiles - prior;
          Icon.compilerAsync = async () => {
            authored++;
            return { doc: structuredClone(doc), diagnostics: [] };
          };
          const inline = () => {
            const icon = document.createElement('anima-icon');
            icon.pause();
            const script = document.createElement('script');
            script.type = 'application/vnd.anima+xml';
            script.text = 'same source';
            icon.append(script);
            document.body.append(icon);
            icons.push(icon);
            return icon.ready;
          };
          await Promise.all([inline(), inline()]);
          const authoredFirst = authored;
          Icon.refresh();
          await inline();
          for (const icon of icons) icon.destroy();
          return { objectCompiles, textCompiles, refreshed, evicted, authoredFirst, authored };
        });
        expect(result).toEqual({
          objectCompiles: 1,
          textCompiles: 1,
          refreshed: 1,
          evicted: 1,
          authoredFirst: 1,
          authored: 2,
        });
      } finally {
        await browser.close();
      }
    }, 30000);

    it('B13 missing feature fails before registration and retries when its web module arrives', async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await add(page, 'index');
        const diagnostics = await page.evaluate(() => {
          const icon = document.createElement('anima-icon');
          document.body.append(icon);
          return icon.load({
            anima: '0.1',
            name: 'features',
            grid: 20,
            requires: ['machine', 'motion'],
            nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
          });
        });
        expect(diagnostics.map((d) => [d.code, d.pointer])).toEqual([
          ['unknown-feature', '/requires/0'],
          ['unknown-feature', '/requires/1'],
        ]);
        await add(page, 'machine');
        await add(page, 'motion');
        await page.waitForFunction(
          () => !!document.querySelector('anima-icon')!.player,
          {},
          { polling: 10 },
        );
        expect(await page.evaluate(() => document.querySelector('anima-icon')!.info!.name)).toBe(
          'features',
        );
      } finally {
        await browser.close();
      }
    }, 30000);

    it('B9 shares compilation without host-edit while keeping concurrent root, nested and repeated assets local', async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        for (const mod of [
          'index',
          'components',
          'data',
          'bind',
          'assets',
          'paint',
          'lists',
          'host',
        ])
          await add(page, mod);
        const result = await page.evaluate(async () => {
          const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
          let compiles = 0;
          Icon.registerModule({
            name: 'probe',
            entries: [],
            load() {
              compiles++;
            },
          });
          const png = (color: string) => {
            const c = document.createElement('canvas');
            c.width = c.height = 1;
            const ctx = c.getContext('2d')!;
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 1, 1);
            return c.toDataURL();
          };
          const red = png('red'),
            blue = png('blue');
          const image = {
            id: 'photo',
            type: 'image',
            asset: 'photo',
            x0: 0,
            y0: 0,
            width: 10,
            height: 10,
          };
          const doc = {
            anima: '0.1',
            name: 'asset-cache',
            grid: 20,
            requires: ['components', 'data', 'bind', 'assets', 'paint', 'lists'],
            assets: { photo: { type: 'image', source: red } },
            data: {
              models: {
                Board: { properties: { items: { type: 'list', of: 'Item' } } },
                Item: { properties: { n: { type: 'number' } } },
              },
              instances: { main: { model: 'Board', default: true, values: { items: [{ n: 1 }] } } },
            },
            components: { badge: { grid: 20, data: 'Item', nodes: [image] } },
            nodes: [
              image,
              { id: 'badge', type: 'instance', component: 'badge' },
              { id: 'rows', type: 'repeat', list: '$items', component: 'badge', dy: 10 },
            ],
          };
          const create = (source: string) => {
            const icon = document.createElement('anima-icon');
            icon.pause();
            icon.assets = async () => source;
            document.body.append(icon);
            const d = icon.load(doc);
            if (d.some((d) => d.severity === 'error')) throw Error(JSON.stringify(d));
            return icon;
          };
          const a = create(red),
            initial = compiles,
            b = create(blue),
            later = compiles - initial;
          await Promise.all([a.ready, b.ready]);
          const colors = (icon: AnimaIcon) =>
            [...icon.shadowRoot!.querySelectorAll('image')].map((i) => i.getAttribute('href'));
          a.player!.step(0);
          b.player!.step(0);
          a.invalidate();
          b.invalidate();
          const initialColors = [
            colors(a).every((c) => c === red),
            colors(b).every((c) => c === blue),
          ];
          a.data.list('$main:items').set([{ n: 1 }, { n: 2 }]);
          a.player!.step(0);
          a.invalidate();
          b.invalidate();
          const grown = [
            colors(a).length,
            colors(a).every((c) => c === red),
            colors(b).length,
            colors(b).every((c) => c === blue),
          ];
          a.destroy();
          b.destroy();
          return { later, initialColors, grown };
        });
        expect(result).toEqual({
          later: 0,
          initialColors: [true, true],
          grown: [4, true, 3, true],
        });
      } finally {
        await browser.close();
      }
    }, 30000);

    it('B9 shares compilation for parsed, text, inline and URL documents across roots', async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent('<base href="http://anima.test/">');
        for (const mod of ['index', 'components', 'data', 'host', 'host-edit'])
          await add(page, mod);
        await page.route('http://anima.test/icons.ani', (route) =>
          route.fulfill({
            body: JSON.stringify({
              anima: '0.1',
              name: 'url',
              grid: 20,
              nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
            }),
          }),
        );
        const result = await page.evaluate(async () => {
          const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
          let compiles = 0;
          Icon.registerModule({
            name: 'probe',
            entries: [],
            load() {
              compiles++;
            },
          });
          const doc = {
            anima: '0.1',
            name: 'library',
            grid: 20,
            requires: ['components'],
            nodes: [{ id: 'base', type: 'circle', center: [10, 10], r: 1 }],
            components: Object.fromEntries(
              Array.from({ length: 10 }, (_, i) => [
                'root' + String.fromCharCode(97 + i),
                {
                  grid: 20,
                  nodes: Array.from({ length: 120 }, (_, j) => ({
                    id:
                      'dot' +
                      String.fromCharCode(97 + (j % 26)) +
                      Math.floor(j / 26)
                        .toString()
                        .replace(/0/g, 'a')
                        .replace(/1/g, 'b')
                        .replace(/2/g, 'c')
                        .replace(/3/g, 'd'),
                    type: 'circle',
                    center: [10, 10],
                    r: 1,
                    fill: { color: '#123456' },
                    x: j / 100,
                  })),
                },
              ]),
            ),
          };
          const text = JSON.stringify(doc);
          const icons: AnimaIcon[] = [];
          const create = (component?: string) => {
            const icon = document.createElement('anima-icon');
            icon.setAttribute('paused', '');
            if (component) icon.setAttribute('component', component);
            document.body.append(icon);
            icons.push(icon);
            return icon;
          };
          const start = performance.now();
          create('roota').load(doc);
          const initial = compiles;
          const firstMs = performance.now() - start;
          const later = performance.now();
          for (let i = 1; i < 24; i++)
            create('root' + String.fromCharCode(97 + (i % 10))).load(doc);
          const laterMs = performance.now() - later;
          const parsedCompiles = compiles - initial;
          const independent = icons[0]!.player !== icons[10]!.player;
          const sameModel = icons[0]!.player!.model === icons[10]!.player!.model;
          create().load(text);
          const textStart = compiles;
          create().load(text);
          const textCompiles = compiles - textStart;
          const inline = async () => {
            const icon = create();
            const script = document.createElement('script');
            script.type = 'application/vnd.anima+json';
            script.text = text;
            icon.append(script);
            // Reconnect to trigger inline discovery after installing the child.
            icon.remove();
            document.body.append(icon);
            await icon.ready;
            return icon;
          };
          await inline();
          const inlineStart = compiles;
          await inline();
          const inlineCompiles = compiles - inlineStart;
          const url = async (otherPolicy = false) => {
            const icon = create();
            if (otherPolicy) {
              icon.assets = () => '';
              icon.assetPolicy = 'any';
            }
            icon.src = 'icons.ani';
            await icon.ready;
            return icon;
          };
          await url();
          const urlStart = compiles;
          await url(true);
          const urlCompiles = compiles - urlStart;
          for (const icon of icons) icon.destroy();
          return {
            bytes: text.length,
            initial,
            parsedCompiles,
            sameModel,
            independent,
            textCompiles,
            inlineCompiles,
            urlCompiles,
            firstMs,
            laterMs,
            totalMs: firstMs + laterMs,
            instantiateMs: laterMs / 23,
          };
        });
        console.log(name + ' B9 timing ' + JSON.stringify(result));
        expect(result.bytes).toBeGreaterThanOrEqual(100000);
        expect(result.initial).toBeGreaterThan(0);
        expect(result).toMatchObject({
          parsedCompiles: 0,
          sameModel: true,
          independent: true,
          textCompiles: 0,
          inlineCompiles: 0,
          urlCompiles: 0,
        });
      } finally {
        await browser.close();
      }
    }, 30000);

    it('B10 selects B from a model loaded as A, resets it, and diagnoses unknown roots', async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        for (const mod of ['index', 'components', 'data', 'host', 'host-edit'])
          await add(page, mod);
        const result = await page.evaluate(() => {
          const create = (component: string) => {
            const icon = document.createElement('anima-icon');
            icon.setAttribute('component', component);
            document.body.append(icon);
            return icon;
          };
          const a = create('alpha');
          a.load({
            anima: '0.1',
            name: 'roots',
            grid: 20,
            requires: ['components'],
            nodes: [{ id: 'base', type: 'circle', center: [10, 10], r: 1 }],
            components: {
              alpha: {
                grid: 10,
                nodes: [{ id: 'base', type: 'circle', center: [10, 10], r: 1 }],
                inputs: { ring: { type: 'trigger' } },
              },
              beta: {
                grid: 30,
                nodes: [{ id: 'base', type: 'circle', center: [10, 10], r: 1 }],
                inputs: { pop: { type: 'trigger' } },
                machine: {
                  layers: {
                    status: {
                      initial: 'idle',
                      states: {
                        idle: { pose: {}, on: [{ when: 'pop', to: 'on' }] },
                        on: { pose: {} },
                      },
                    },
                  },
                },
              },
            },
          });
          const b = create('beta');
          b.loadModel(a.player!.model);
          b.fire('pop');
          b.player!.step(0);
          const selected = [b.info!.name, b.info!.grid, b.player!.states().status];
          b.reset();
          const reset = [b.info!.name, b.info!.grid, b.player!.states().status];
          const missing = create('absent');
          let diagnostic: unknown;
          missing.addEventListener('anima:error', (e) => {
            diagnostic = (e as CustomEvent).detail[0];
          });
          missing.loadModel(a.player!.model);
          a.destroy();
          b.destroy();
          missing.destroy();
          return { selected, reset, diagnostic };
        });
        expect(result.selected).toEqual(['beta', 30, 'on']);
        expect(result.reset).toEqual(['beta', 30, 'idle']);
        expect(result.diagnostic).toMatchObject({
          code: 'unknown-component',
          severity: 'error',
          pointer: '/component',
          message: expect.stringContaining('absent'),
          hint: expect.stringMatching(/alpha.*beta/),
        });
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    }, 30000);

    it('B11 commits offscreen data before the visibility callback returns; B12 settles derived guards', async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.evaluate(() => {
          (window as unknown as { visible: (on: boolean) => void }).visible = () => {};
          window.IntersectionObserver = class {
            constructor(callback: IntersectionObserverCallback) {
              (window as unknown as { visible: (on: boolean) => void }).visible = (on) =>
                callback(
                  [
                    {
                      target: document.querySelector('anima-icon')!,
                      isIntersecting: on,
                    } as unknown as IntersectionObserverEntry,
                  ],
                  this as unknown as IntersectionObserver,
                );
            }
            observe() {}
            unobserve() {}
            disconnect() {}
          } as unknown as typeof IntersectionObserver;
        });
        for (const mod of ['index', 'data', 'bind', 'derive', 'host', 'host-edit'])
          await add(page, mod);
        const result = await page.evaluate(() => {
          const icon = document.createElement('anima-icon');
          document.body.append(icon);
          icon.load({
            anima: '0.1',
            name: 'settle',
            grid: 20,
            requires: ['data', 'bind', 'derive'],
            nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
            data: {
              models: {
                Kit: {
                  properties: {
                    status: { type: 'number' },
                    hasStatus: { type: 'bool', value: '$status > 0' },
                  },
                },
              },
              instances: { kit: { model: 'Kit', default: true } },
            },
            bind: { 'dot.r': '$status + 1' },
            machine: {
              layers: {
                status: {
                  initial: 'none',
                  states: {
                    none: { pose: {}, on: [{ when: '$kit:hasStatus == true', to: 'on' }] },
                    on: { pose: {}, on: [{ when: '$kit:hasStatus == false', to: 'none' }] },
                  },
                },
              },
            },
          });
          const visible = (on: boolean) =>
            (window as unknown as { visible: (on: boolean) => void }).visible(on);
          visible(false);
          icon.data.number('$kit:status').set(2);
          const before = [icon.player!.get('$kit:status'), icon.player!.states().status];
          visible(true);
          const after = [
            icon.player!.get('$kit:hasStatus'),
            icon.player!.states().status,
            icon.shadowRoot!.querySelector('circle')!.getAttribute('r'),
          ];
          icon.data.number('$kit:status').set(0);
          icon.player!.step(0);
          icon.invalidate();
          const settled = [icon.player!.get('$kit:hasStatus'), icon.player!.states().status];
          icon.pause();
          visible(false);
          icon.data.number('$kit:status').set(2);
          visible(true);
          const paused = icon.player!.get('$kit:status');
          icon.play();
          const resumed = icon.player!.states().status;
          icon.destroy();
          return { before, after, settled, paused, resumed };
        });
        expect(result).toEqual({
          before: [0, 'none'],
          after: [true, 'on', '3'],
          settled: [false, 'none'],
          paused: 0,
          resumed: 'on',
        });
      } finally {
        await browser.close();
      }
    }, 30000);
  });
