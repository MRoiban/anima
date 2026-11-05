import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { beforeAll, describe, it, expect } from 'vitest';
import type { AnimaIcon } from '../src/index.ts';
import { bundle } from '../../../tools/browser-build.ts';

const bundles = new Map<string, string>();
beforeAll(async () => {
  const entries = ['index', 'markup', 'components', 'bind', 'assets', 'composite', 'markup-paint'];
  await Promise.all(
    entries.map(async (entry) => {
      bundles.set(entry, await bundle(resolve('packages/web/src/' + entry + '.ts')));
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
              const Icon = customElements.get('anima-icon') as typeof AnimaIcon & {
                markupStructure?: object;
              };
              return (
                Icon &&
                (name === 'index' ||
                  (name === 'markup'
                    ? !!Icon.compiler
                    : name === 'markup-paint'
                      ? !!Icon.markupStructure
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
          const result = await page.evaluate(async () => {
            const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
            const source = `<anima version="0.1" name="scopes" grid="8" requires="components bind assets composite">
              <asset name="data" type="blob" src="data:application/octet-stream;base64,AA=="/>
              <color name="red" value="#f00"/>
              <ease name="soft" curve="in"/>
              <component name="badge" grid="8">
                <number name="count" default="2"/><bool name="enabled"/>
                <ease name="soft" curve="out"/>
                <circle id="dot" cx="4" cy="4" r="1" fill="red"/>
                <bind target="dot.r" value="count"/>
                <timeline name="grow" duration="1"><track target="dot.r">0 1 soft; 1 3</track></timeline>
              </component>
              <number name="unread" default="3"/>
              <circle id="dot" cx="4" cy="4" r="2"/>
              <group id="g"><clip source="dot"/></group>
              <instance id="b" component="badge" count="{unread}" enabled="true"/>
              <instance id="literal" component="badge" count="2"/>
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
  });
