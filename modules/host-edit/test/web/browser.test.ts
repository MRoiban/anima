import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { describe, it, expect } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../web/index.ts';
import type {} from '../../../host/web/index.ts';
const nativeSelection = JSON.parse(
  readFileSync(new URL('../../oracle/rive/frames/selected.json', import.meta.url), 'utf8'),
).artboard as string;
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
  describe(name + ' host-edit', () => {
    for (const first of [true, false])
      it(
        'separate bundles in both load orders: edit first=' + first,
        async () => {
          if (!existsSync(executablePath)) throw Error('browser absent');
          const browser = await engine.launch({ executablePath, headless: true });
          try {
            const page = await browser.newPage();
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(e.message));
            await page.setContent(
              '<base href="http://anima.test/"><anima-icon id="early" auto-bind paused></anima-icon>',
            );
            const add = async (mod: string) =>
              page.addScriptTag({
                type: 'module',
                content: await bundle(resolve('packages/web/src/' + mod + '.ts')),
              });
            await add('index');
            for (const mod of first
              ? ['host-edit', 'data', 'host', 'bind', 'paint', 'assets', 'components', 'markup']
              : ['components', 'data', 'host', 'bind', 'paint', 'assets', 'markup'])
              await add(mod);
            await page.waitForFunction(
              () =>
                (
                  customElements.get('anima-icon') as typeof import('../../web/index.ts').AnimaIcon
                ).modules.has('host'),
              {},
              { polling: 10 },
            );
            await page.evaluate(() => {
              const icon = document.querySelector('#early') as AnimaIcon;
              icon.load({
                anima: '0.1',
                name: 'early',
                grid: 20,
                requires: ['data'],
                nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
                data: {
                  models: {
                    Root: {
                      properties: {
                        n: { type: 'number', default: 7 },
                        items: { type: 'list', of: 'Item' },
                      },
                    },
                    Item: { properties: { n: { type: 'number' } } },
                  },
                },
              });
              icon.data.bind('default');
              icon.data.number('$n').set(9);
              icon.player!.step(0);
            });
            if (!first) {
              expect(
                await page.evaluate(
                  () =>
                    typeof (document.querySelector('#early') as AnimaIcon).data.list('$items').add,
                ),
              ).toBe('undefined');
              await add('host-edit');
            }
            await page.waitForFunction(
              () =>
                (
                  customElements.get('anima-icon') as typeof import('../../web/index.ts').AnimaIcon
                ).modules.has('hostedit'),
              {},
              { polling: 10 },
            );
            const result = await page.evaluate(async () => {
              const Icon = customElements.get(
                'anima-icon',
              ) as typeof import('../../web/index.ts').AnimaIcon;
              await Icon.ready;
              const early = document.querySelector('#early') as AnimaIcon;
              const earlyValue = early.data.number('$n').value;
              early.data.list('$items').add({ n: 12 });
              early.player!.step(0);
              const earlyItem = early.data.list('$items').at(0).number('n').value;
              const icon = document.createElement('anima-icon');
              icon.setAttribute('auto-bind', '');
              icon.setAttribute('paused', '');
              document.body.append(icon);
              const makePNG = (color: string) => {
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                const ctx = canvas.getContext('2d')!;
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, 1, 1);
                return canvas.toDataURL();
              };
              const red = makePNG('#ff0000'),
                blue = makePNG('#0000ff');
              const doc = {
                anima: '0.1',
                name: 'edit-browser',
                grid: 20,
                requires: ['data', 'components', 'assets', 'paint'],
                assets: { photo: { type: 'image', source: red } },
                data: {
                  models: {
                    Board: {
                      properties: {
                        tint: { type: 'color', default: '#12345678' },
                        mood: { type: 'enum', values: ['calm', 'happy'] },
                        picture: { type: 'asset-ref', assetType: 'image', default: 'photo' },
                        items: { type: 'list', of: 'Item' },
                      },
                    },
                    Item: { properties: { n: { type: 'number', default: 3 } } },
                  },
                  instances: {
                    main: {
                      model: 'Board',
                      default: true,
                      values: { items: [{ n: 4 }, { n: 8 }] },
                    },
                  },
                },
                components: {
                  badge: {
                    assets: { photo: { type: 'image', source: red } },
                    grid: 10,
                    inputs: { radius: { type: 'number', default: 2 } },
                    nodes: [{ id: 'dot', type: 'circle', center: [5, 5], r: 1 }],
                    bind: { 'dot.r': 'radius' },
                  },
                },
                nodes: [
                  {
                    id: 'picture',
                    type: 'image',
                    asset: 'photo',
                    x0: 0,
                    y0: 0,
                    width: 10,
                    height: 10,
                  },
                  { id: 'badge', type: 'instance', component: 'badge' },
                ],
              };
              const diagnostics = icon.load(doc);
              await icon.ready;
              const list = icon.data.list('items'),
                firstItem = list.at(0);
              const deliveries: unknown[] = [];
              list.on('change', (v) => deliveries.push(v));
              icon.data.batch(() => {
                list.add({ n: 9 });
                list.insert(0, { n: 2 });
                list.swap(1, 2);
              });
              icon.player!.step(0);
              const listValue = list.value;
              list.remove(firstItem);
              icon.player!.step(0);
              icon.data.color('tint').set([1, 2, 3, 255]);
              icon.data.enum('mood').index = 1;
              icon.player!.step(0);
              const helpers = [
                icon.data.color('tint').hex,
                icon.data.enum('mood').values,
                icon.data.enum('mood').index,
              ];
              const child = icon.instance('badge');
              child.set('radius', 6);
              icon.player!.step(0);
              const childRadius = child.value('dot.r');
              child.data.bind(child.data.defaultInstance());
              const nestedValue = child.data.enum('mood').value;
              const other = document.createElement('anima-icon');
              other.setAttribute('paused', '');
              document.body.append(other);
              other.load(doc);
              await other.ready;
              await icon.data.image('picture').set(blue);
              icon.player!.step(0);
              icon.invalidate();
              const href = icon.shadowRoot!.querySelector('image')!.getAttribute('href');
              const isolatedImage =
                other.shadowRoot!.querySelector('image')!.getAttribute('href') === red;
              const bytes = Uint8Array.from(atob(red.split(',')[1]!), (c) => c.charCodeAt(0));
              await icon.data.image('picture').set(new Blob([bytes], { type: 'image/png' }));
              icon.player!.step(0);
              icon.invalidate();
              const blobReplaced =
                icon.shadowRoot!.querySelector('image')!.getAttribute('href') === red;
              const xml =
                '<anima version="0.1" name="other" grid="20" requires="components"><component name="small" grid="10"><circle id="dot" cx="5" cy="5" r="3"/></component><circle id="root" cx="10" cy="10" r="1"/></anima>';
              const selected = document.createElement('anima-icon');
              selected.setAttribute('component', 'small');
              selected.setAttribute('paused', '');
              document.body.append(selected);
              const componentDiagnostics = selected.load(xml, true);
              await selected.ready;
              selected.reset();
              const resetName = selected.player!.model.doc.name;
              const selectedJSON = document.createElement('anima-icon');
              selectedJSON.setAttribute('component', 'badge');
              selectedJSON.setAttribute('paused', '');
              document.body.append(selectedJSON);
              const jsonDiagnostics = selectedJSON.load(JSON.stringify(doc));
              await selectedJSON.ready;
              selectedJSON.player!.step(0);
              const jsonSelection = [
                selectedJSON.player!.model.doc.name,
                selectedJSON.player!.model.grid,
                selectedJSON.player!.value('dot.r'),
              ];
              let instanceError = '';
              try {
                icon.instance('absent');
              } catch (e) {
                instanceError = (e as { code: string }).code;
              }
              let imageError = '';
              try {
                await icon.data.image('picture').set('data:image/png;base64,AAAA');
              } catch (e) {
                imageError = (e as { code: string }).code;
              }
              return {
                earlyValue,
                earlyItem,
                diagnostics,
                listValue,
                afterRemove: list.value,
                deliveries: deliveries.length,
                helpers,
                childRadius,
                nestedValue,
                replaced: href === blue,
                isolatedImage,
                blobReplaced,
                componentDiagnostics,
                resetName,
                jsonDiagnostics,
                jsonSelection,
                selectedName: selected.player!.model.doc.name,
                selectedGrid: selected.player!.model.grid,
                selectedRadius: selected.player!.model.nodes[0]!.raw.r,
                instanceError,
                imageError,
              };
            });
            expect(result).toEqual({
              earlyValue: 9,
              earlyItem: 12,
              diagnostics: [],
              listValue: [{ n: 2 }, { n: 8 }, { n: 4 }, { n: 9 }],
              afterRemove: [{ n: 2 }, { n: 8 }, { n: 9 }],
              deliveries: 2,
              helpers: ['#010203', ['calm', 'happy'], 1],
              childRadius: 6,
              nestedValue: 'calm',
              replaced: true,
              isolatedImage: true,
              blobReplaced: true,
              componentDiagnostics: [],
              resetName: nativeSelection,
              jsonDiagnostics: [],
              jsonSelection: ['badge', 10, 2],
              selectedName: nativeSelection,
              selectedGrid: 10,
              selectedRadius: 3,
              instanceError: 'data-instance',
              imageError: 'data-asset',
            });
            expect(errors).toEqual([]);
          } finally {
            await browser.close();
          }
        },
        30000,
      );
  });
