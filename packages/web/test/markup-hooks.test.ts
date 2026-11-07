import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { beforeAll, describe, it, expect } from 'vitest';
import type { AnimaIcon } from '../src/index.ts';
import { cachedBundle as bundle } from '../../../tools/browser-cache.ts';

const bundles = new Map<string, string>();
beforeAll(async () => {
  const entries = [
    'index',
    'markup',
    'components',
    'bind',
    'assets',
    'composite',
    'markup-paint',
    'surface',
    'markup-libraries',
  ];
  await Promise.all(
    entries.map(async (entry) => {
      bundles.set(
        entry,
        await bundle(
          resolve(
            entry === 'markup-libraries'
              ? 'modules/markup/test/web/fixtures/libraries.ts'
              : 'packages/web/src/' + (entry === 'markup' ? 'markup-hooks' : entry) + '.ts',
          ),
        ),
      );
    }),
  );
}, 30000);

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
  describe(name + ' optional markup hooks', () => {
    it.each(['markup-first', 'modules-first'])(
      '%s: diagnostics without hooks; scoped compilation and async compilation with hooks',
      async (order) => {
        const executablePath = paths.find((p) => p && existsSync(p));
        if (!executablePath) throw Error('browser absent');
        const browser = await engine.launch({ executablePath, headless: true });
        try {
          const page = await browser.newPage();
          const add = async (entry: string) => {
            await page.addScriptTag({
              type: 'module',
              content: bundles.get(entry)!,
            });
            await page.waitForFunction((name) => {
              const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
              return (
                Icon &&
                (name === 'index' ||
                  (name === 'markup'
                    ? !!Icon.compiler
                    : name === 'markup-paint'
                      ? !!Icon.markupHooks.paint
                      : Icon.modules.has(name)))
              );
            }, entry);
          };
          await page.setContent('<anima-icon paused></anima-icon>');
          await add('index');
          if (order === 'markup-first') {
            await add('markup');
            const errors = await page.evaluate(() => {
              const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
              return [
                '<component name="c" grid="8"/>',
                '<instance id="i" component="c"/>',
                '<bind target="dot.r" value="1"/>',
              ].map(
                (child) =>
                  Icon.compiler!(`<anima version="0.1" name="missing" grid="8">${child}</anima>`)
                    .diagnostics[0],
              );
            });
            expect(errors.map((d) => d.code)).toEqual([
              'markup-components-unavailable',
              'markup-components-unavailable',
              'markup-bind-unavailable',
            ]);
            for (const d of errors) {
              expect(d.pointer).toBe('');
              expect(d.line).toBe(1);
              expect(d.column).toBeGreaterThan(1);
              expect(d.message).toContain('@anima-format/web/');
              expect(d.hint).toBe(d.message);
            }
          }
          for (const entry of ['components', 'bind', 'assets', 'composite']) await add(entry);
          if (order === 'modules-first') await add('markup');
          const missingPaint = await page.evaluate(() => {
            const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
            return Icon.compiler!(
              '<anima version="0.1" name="clip" grid="8" requires="composite"><circle id="source" cx="4" cy="4" r="2"/><group id="g"><clip source="source"/></group></anima>',
            ).diagnostics;
          });
          expect(missingPaint).toEqual([
            expect.objectContaining({
              code: 'markup-paint-unavailable',
              pointer: '/nodes/1',
              message: expect.stringContaining('@anima-format/web/markup-paint'),
            }),
          ]);
          expect(
            await page.evaluate(() => {
              const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
              return Icon.compiler!(
                '<anima version="0.1" name="assets" grid="8" requires="assets"><asset name="data" type="blob" src="data:application/octet-stream;base64,AA=="/><circle id="dot" cx="4" cy="4" r="1"/></anima>',
              ).diagnostics;
            }),
          ).toEqual([]);
          await add('markup-paint');
          await add('surface');
          const result = await page.evaluate(async () => {
            const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
            const source = `<anima version="0.1" name="scopes" grid="8" requires="components bind assets composite paint surface">
              <asset name="data" type="blob" src="data:application/octet-stream;base64,AA=="/>
              <asset name="tile" type="image" src="data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%228%22%20height=%228%22/%3E"/>
              <rect id="photo" x0="0" y0="0" width="8" height="8"><imagePaint asset="tile" image-width="8" image-height="8"/><feather outer="1" enabled="false"/></rect>
              <color name="red" value="#f00"/>
              <ease name="soft" curve="in"/>
              <component name="badge" grid="8">
                <number name="count" default="2"/><bool name="enabled"/>
                <ease name="soft" curve="out"/>
                <circle id="dot" cx="4" cy="4" r="1" fill="red"/>
                <bind target="dot.r" value="count"/>
                <listener on="click" emit="selected"/>
                <timeline name="grow" duration="1"><track target="dot.r">0 1 soft; 1 3</track></timeline>
              </component>
              <component name="pair" grid="8"><instance id="child" component="badge"/></component>
              <instance id="nested" component="pair"/>
              <number name="unread" default="3"/>
              <circle id="dot" cx="4" cy="4" r="2"/>
              <group id="g"><clip source="dot"/></group>
              <instance id="b" component="badge" count="{unread}" enabled="true"/>
              <instance id="literal" component="badge" count="2"/>
              <listener on="b.selected" emit="seen"/>
              <timeline name="grow" duration="1"><track target="dot.r">0 2 soft; 1 4</track></timeline>
            </anima>`;
            const sync = Icon.compiler!(source);
            const asyncResult = await Icon.compilerAsync!(
              source,
              'https://example.invalid/scopes.animl',
            );
            const diagnostics = (document.querySelector('anima-icon') as AnimaIcon).load(
              source,
              true,
            );
            return { sync, asyncResult, diagnostics };
          });
          expect(result.sync.diagnostics).toEqual([]);
          expect(result.asyncResult.diagnostics).toEqual([]);
          expect(result.asyncResult.doc).toEqual(result.sync.doc);
          expect(result.diagnostics).toEqual([]);
          expect(result.sync.doc).toMatchObject({
            assets: { data: { type: 'blob', source: expect.any(String) } },
            components: {
              badge: {
                colors: { red: '#f00' },
                timelines: {
                  grow: {
                    tracks: {
                      'dot.r': [
                        [0, 1, 'out'],
                        [1, 3],
                      ],
                    },
                  },
                },
              },
            },
            timelines: {
              grow: {
                tracks: {
                  'dot.r': [
                    [0, 2, 'in'],
                    [1, 4],
                  ],
                },
              },
            },
            nodes: expect.arrayContaining([
              {
                id: 'photo',
                type: 'rect',
                fill: {
                  type: 'image',
                  asset: 'tile',
                  imageWidth: 8,
                  imageHeight: 8,
                  feather: { outer: 1, enabled: false },
                },
                x0: 0,
                y0: 0,
                w: 8,
                h: 8,
              },
              {
                type: 'instance',
                id: 'b',
                component: 'badge',
                inputs: { count: '{unread}', enabled: true },
              },
            ]),
          });
        } finally {
          await browser.close();
        }
      },
      30000,
    );

    it.each([
      'markup-first',
      'bind-first',
      'delayed-bind',
      'delayed-surface',
      'explicit-load',
      'detached',
    ])(
      '%s: connected inline sources recover when optional entries arrive',
      async (order) => {
        const executablePath = paths.find((p) => p && existsSync(p));
        if (!executablePath) throw Error('browser absent');
        const browser = await engine.launch({ executablePath, headless: true });
        try {
          const page = await browser.newPage();
          const surface = order === 'delayed-surface';
          const source = surface
            ? `<anima version="0.1" name="surface" grid="8" requires="paint surface">
                <group id="g"><slice x="0 8" y="0 8" width="16" height="8" modes="stretch"/>
                  <circle id="dot" cx="4" cy="4" r="2" fill="#000"><feather outer="1" offset="1 -1" enabled="false"/></circle>
                </group></anima>`
            : `<anima version="0.1" name="binding" grid="8" requires="bind">
                <number name="amount" default="3"/>
                <circle id="dot" cx="4" cy="4" r="1" fill="#000"/>
                <bind target="dot.r" value="amount"/>
              </anima>`;
          await page.setContent(
            order === 'explicit-load'
              ? '<anima-icon paused></anima-icon>'
              : `<anima-icon paused><script type="application/vnd.anima+xml">${source}</script></anima-icon>`,
          );

          const add = async (entry: string) => {
            await page.addScriptTag({ type: 'module', content: bundles.get(entry)! });
            await page.waitForFunction((entry) => {
              const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
              return (
                Icon &&
                (entry === 'index' ||
                  (entry === 'markup' ? !!Icon.compiler : Icon.modules.has(entry)))
              );
            }, entry);
          };
          await add('index');
          if (order === 'explicit-load')
            await page.evaluate(
              (source) => (document.querySelector('anima-icon') as AnimaIcon).load(source, true),
              source,
            );
          // Exercise recovery after an actual failed attempt, rather than relying on script timing.
          expect(
            await page.evaluate(async () => {
              try {
                await (document.querySelector('anima-icon') as AnimaIcon).ready;
                return [];
              } catch (d) {
                return (d as { code: string }[]).map((d) => d.code);
              }
            }),
          ).toContain('markup-unavailable');
          if (order === 'detached')
            await page.evaluate(() => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              (window as unknown as { detached: AnimaIcon }).detached = icon;
              icon.remove();
            });
          if (order === 'bind-first') {
            await add('bind');
            await add('markup');
          } else {
            await add('markup');
            if (order === 'delayed-bind') {
              // Playwright returns after insertion, not inline ESM evaluation. Hold evaluation
              // explicitly to reproduce the bind test's missing registration deterministically.
              await page.addScriptTag({
                type: 'module',
                content: `await new Promise(resolve => { window.releaseBinding = resolve; });\n${bundles.get('bind')!}`,
              });
              await page.waitForFunction(
                () => !!(window as unknown as { releaseBinding?: () => void }).releaseBinding,
              );
              expect(
                await page.evaluate(() =>
                  (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('bind'),
                ),
              ).toBe(false);
              await page.evaluate(() =>
                (window as unknown as { releaseBinding: () => void }).releaseBinding(),
              );
            } else await add(surface ? 'surface' : 'bind');
          }
          if (order === 'detached')
            await page.evaluate(() => {
              const icon = (window as unknown as { detached: AnimaIcon }).detached;
              if (icon.player) throw Error('detached source retried');
              document.body.append(icon);
            });
          await page.waitForFunction(
            () => !!(document.querySelector('anima-icon') as AnimaIcon).player,
          );
          const result = await page.evaluate(async () => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            await icon.ready;
            icon.player!.step(0);
            return {
              doc: icon.player!.model.doc,
              r: icon.player!.value('dot.r'),
              svg: !!icon.shadowRoot!.querySelector('svg'),
            };
          });
          expect(result.svg).toBe(true);
          if (surface)
            expect(result.doc).toMatchObject({
              nodes: [
                {
                  slice: { x: [0, 8], y: [0, 8], modes: ['stretch'] },
                  children: [
                    { fill: { color: '#000', feather: { offset: [1, -1], enabled: false } } },
                  ],
                },
              ],
            });
          else expect(result.r).toBe(3);
          // Explicit destruction cancels the retained source and all registration listeners.
          expect(
            await page.evaluate(async () => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              icon.destroy();
              (customElements.get('anima-icon') as typeof AnimaIcon).refresh();
              await new Promise<void>((resolve) => queueMicrotask(resolve));
              return icon.player === undefined;
            }),
          ).toBe(true);
        } finally {
          await browser.close();
        }
      },
      30000,
    );

    it('retries a stale compiler snapshot when a module arrives during a library fetch', async () => {
      const executablePath = paths.find((p) => p && existsSync(p));
      if (!executablePath) throw Error('browser absent');
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        let release!: () => void;
        let requested!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const firstRequest = new Promise<void>((resolve) => {
          requested = resolve;
        });
        let requests = 0;
        await page.route('https://anima.test/ui.animl', async (route) => {
          requests++;
          requested();
          await gate;
          await route.fulfill({
            contentType: 'application/xml',
            body: '<library name="ui"><color name="ink" value="#000"/></library>',
          });
        });
        await page.setContent(`<anima-icon paused><script type="application/vnd.anima+xml">
          <anima version="0.1" name="late" grid="8" requires="bind">
            <import src="https://anima.test/ui.animl" as="ui"/>
            <number name="amount" default="3"/>
            <circle id="dot" cx="4" cy="4" r="1" fill="ui:ink"/>
            <bind target="dot.r" value="amount"/>
          </anima>
        </script></anima-icon>`);
        await page.addScriptTag({ type: 'module', content: bundles.get('markup-libraries')! });
        await firstRequest;
        await page.addScriptTag({ type: 'module', content: bundles.get('bind')! });
        await page.waitForFunction(() =>
          (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('bind'),
        );
        release();
        await page.waitForFunction(
          () => !!(document.querySelector('anima-icon') as AnimaIcon).player,
        );
        expect(requests).toBe(2); // One fetch per attempt: the second uses the newly registered compiler hooks.
        expect(
          await page.evaluate(() => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            icon.player!.step(0);
            return icon.player!.value('dot.r');
          }),
        ).toBe(3);
      } finally {
        await browser.close();
      }
    }, 30000);
  });
