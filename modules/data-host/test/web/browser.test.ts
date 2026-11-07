import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser } from 'playwright-core';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../../host/web/index.ts';
import type {} from '../../../host-edit/web/index.ts';
import { document as hostDocument } from '../core/fixture.ts';
for (const [name, engine, cache] of [
  [
    'Chromium',
    chromium,
    '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['Firefox', firefox, '.cache/ms-playwright/firefox-1555/firefox/firefox'],
] as const)
  describe(name + ' data-host', () => {
    let browser: Browser;
    const entries = [
      'index',
      'data-host',
      'input',
      'bind',
      'components',
      'nested',
      'host-edit',
      'host',
      'data',
      'assets',
      'paint',
      'markup',
    ];
    const bundles = new Map<string, string>();
    beforeAll(async () => {
      await Promise.all(
        entries.map(async (e) =>
          bundles.set(e, await bundle(resolve('packages/web/src/' + e + '.ts'))),
        ),
      );
      const executablePath = [resolve(homedir(), cache), engine.executablePath()].find(existsSync);
      if (!executablePath) throw Error('browser absent');
      browser = await engine.launch({ executablePath, headless: true });
    });
    afterAll(async () => {
      await browser?.close();
    });
    for (const order of [entries, ['index', ...entries.slice(1).reverse()]])
      it(
        'nested data, batches, computed snapshots and reflected src: ' + order.join(','),
        async () => {
          const page = await browser.newPage();
          try {
            await page.setContent('<base href="http://anima.test/">');
            for (const entry of order)
              await page.addScriptTag({ type: 'module', content: bundles.get(entry)! });
            await page.waitForFunction(
              () => (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('datahost'),
              {},
              { polling: 10 },
            );
            await page.route('http://anima.test/icon.ani', (route) =>
              route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                  ...hostDocument(),
                  requires: [...hostDocument().requires, 'input'],
                  listeners: [{ on: 'key-down', write: '$team.lead.name', value: 'key-pressed' }],
                }),
              }),
            );
            const actual = await page.evaluate(async () => {
              const icon = document.createElement('anima-icon');
              icon.setAttribute('auto-bind', '');
              icon.setAttribute('paused', '');
              document.body.append(icon);
              icon.src = 'icon.ani';
              await icon.ready;
              let notifications = 0;
              icon.data.at('team.lead.name').on('change', () => notifications++);
              icon.data.batch(() => {
                icon.data.string('team.lead.name').set('Grace');
                icon.data.string('team.lead.name').set('Marie');
                icon.data.color('team.lead.tint').set('#abcdef');
              });
              const initial = icon.data.at('team.lead.name').value;
              icon.player!.step(0);
              const result = {
                src: icon.src,
                attribute: icon.getAttribute('src'),
                initial,
                name: icon.data.at('team.lead.name').value,
                notifications,
                color: icon.data.color('team.lead.tint').value,
                exports: icon.data.exportedInstances(),
                computed: icon.player!.computed('dot'),
              };
              icon.dispatchEvent(new KeyboardEvent('keydown', { key: 'F13', bubbles: true }));
              icon.player!.step(0);
              const key = icon.data.string('team.lead.name').value;
              icon.destroy();
              return { ...result, key };
            });
            expect(actual).toMatchObject({
              src: 'icon.ani',
              attribute: 'icon.ani',
              initial: 'Ada',
              name: 'Marie',
              key: 'F13',
              notifications: 1,
              color: [171, 205, 239, 255],
              exports: [{ name: 'main', model: 'Root' }],
              computed: { opacity: 1 },
            });
          } finally {
            await page.close();
          }
        },
        30000,
      );
    it('keeps two data image properties using the same authored asset independent', async () => {
      const page = await browser.newPage();
      try {
        await page.setContent('<base href="http://anima.test/">');
        for (const entry of entries)
          await page.addScriptTag({ type: 'module', content: bundles.get(entry)! });
        await page.waitForFunction(
          () => (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('datahost'),
          {},
          { polling: 10 },
        );
        const result = await page.evaluate(async () => {
          const png = (color: string) => {
            const c = document.createElement('canvas');
            c.width = c.height = 2;
            const ctx = c.getContext('2d')!;
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 2, 2);
            return c.toDataURL();
          };
          const red = png('red'),
            blue = png('blue'),
            green = png('green');
          const icon = document.createElement('anima-icon');
          icon.setAttribute('paused', '');
          icon.setAttribute('auto-bind', '');
          document.body.append(icon);
          const diagnostics = icon.load({
            anima: '0.1',
            name: 'image-paths',
            grid: 20,
            requires: ['assets', 'paint', 'bind', 'data'],
            assets: { photo: { type: 'image', source: red } },
            data: {
              models: {
                Root: {
                  properties: {
                    one: { type: 'asset-ref', assetType: 'image', default: 'photo' },
                    two: { type: 'asset-ref', assetType: 'image', default: 'photo' },
                  },
                },
              },
            },
            nodes: [
              { id: 'one', type: 'image', asset: 'photo', x0: 0, y0: 0, width: 10, height: 10 },
              { id: 'two', type: 'image', asset: 'photo', x0: 10, y0: 0, width: 10, height: 10 },
            ],
            bind: { 'one.asset': { value: '$one' }, 'two.asset': { value: '$two' } },
          });
          if (diagnostics.some((d) => d.severity === 'error'))
            throw Error(JSON.stringify(diagnostics));
          await icon.ready;
          await Promise.all([icon.data.image('one').set(blue), icon.data.image('two').set(green)]);
          icon.player!.step(0);
          icon.invalidate();
          const colors = () =>
            [...icon.shadowRoot!.querySelectorAll('image')].map((n) =>
              n.getAttribute('href') === blue
                ? 'blue'
                : n.getAttribute('href') === green
                  ? 'green'
                  : 'red',
            );
          const both = colors();
          icon.data.image('two').set(icon.data.image('one').value);
          icon.player!.step(0);
          await icon.data.image('one').set(red);
          icon.player!.step(0);
          icon.invalidate();
          const again = colors();
          icon.destroy();
          return { both, again };
        });
        expect(result).toEqual({ both: ['blue', 'green'], again: ['red', 'blue'] });
      } finally {
        await page.close();
      }
    }, 30000);
    it('replaces an image on one nested player while another shares the compiled component', async () => {
      const page = await browser.newPage();
      try {
        await page.setContent('<base href="http://anima.test/">');
        for (const entry of entries)
          await page.addScriptTag({ type: 'module', content: bundles.get(entry)! });
        await page.waitForFunction(
          () => (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('datahost'),
          {},
          { polling: 10 },
        );
        const actual = await page.evaluate(async () => {
          const png = (color: string) => {
            const c = document.createElement('canvas');
            c.width = c.height = 2;
            const ctx = c.getContext('2d')!;
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 2, 2);
            return c.toDataURL();
          };
          const red = png('red'),
            blue = png('blue');
          const icon = document.createElement('anima-icon');
          icon.setAttribute('paused', '');
          document.body.append(icon);
          const diagnostics = icon.load({
            anima: '0.1',
            name: 'scoped-image',
            grid: 20,
            requires: ['assets', 'paint', 'components', 'data'],
            assets: { photo: { type: 'image', source: red } },
            components: {
              badge: {
                grid: 10,
                data: {
                  models: {
                    Photo: {
                      properties: {
                        picture: { type: 'asset-ref', assetType: 'image', default: 'photo' },
                      },
                    },
                  },
                },
                nodes: [
                  { id: 'pic', type: 'image', asset: 'photo', x0: 0, y0: 0, width: 10, height: 10 },
                ],
              },
            },
            nodes: [
              { id: 'left', type: 'instance', component: 'badge' },
              { id: 'right', type: 'instance', component: 'badge', x: 10 },
            ],
          });
          if (diagnostics.some((d) => d.severity === 'error'))
            throw Error(JSON.stringify(diagnostics));
          await icon.ready;
          const a = icon.instance('left'),
            b = icon.instance('right');
          a.data.bind('default');
          b.data.bind('default');
          const shared = a.model === b.model;
          await a.data.image('picture').set(blue);
          icon.player!.step(0);
          icon.invalidate();
          const sources = [...icon.shadowRoot!.querySelectorAll('image')].map((n) =>
            n.getAttribute('href'),
          );
          const result = {
            shared,
            sources: sources.map((s) => (s === blue ? 'blue' : s === red ? 'red' : s)),
          };
          const retained = a.data.image('picture');
          icon.destroy();
          let destroyed = '';
          try {
            await retained.set(red);
          } catch (error) {
            destroyed = (error as { code: string }).code;
          }
          return { ...result, destroyed };
        });
        expect(actual).toEqual({ shared: true, sources: ['blue', 'red'], destroyed: 'data-asset' });
      } finally {
        await page.close();
      }
    }, 30000);
  });
