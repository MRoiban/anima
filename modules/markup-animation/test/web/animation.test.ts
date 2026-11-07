import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { beforeAll, describe, expect, it } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';

const bundles = new Map<string, string>();
// Use the self-contained reference document; the authored example imports a separate library.
const expected = readFileSync('examples/bell.ani', 'utf8');
const bell = decompile(expected);
const keyed = readFileSync('modules/motion/examples/data-keys.animl', 'utf8')
  .replace('<key t="0" value="0"/>', '0 0;')
  .replace('<key t="1" value="$peak"/>', '1 $peak');
const keyedResult = compile(keyed);
const keyedExpected = keyedResult.doc;
const wrap = (child: string) =>
  `<anima version="0.1" name="test" grid="8"><circle id="dot" cx="4" cy="4" r="1"/>${child}</anima>`;
const missing = [
  [
    '<timeline name="t" duration="1"><track target="dot.r">0 1; 1 2</track></timeline>',
    '/timelines/t/tracks/dot.r',
  ],
  ['<ease name="soft" curve="in"/>', ''],
  [
    '<layer name="main" initial="idle"><state name="idle"><on when="true" to="idle"/></state></layer>',
    '/machine/layers/main/states/idle/on/0/when',
  ],
  ['<bool name="active"/><listener on="click" set="active=true"/>', '/listeners/0/set'],
] as const;
beforeAll(async () => {
  await Promise.all(
    ['index', 'markup', 'markup-animation', 'markup-hooks', 'data', 'motion'].map(async (entry) =>
      bundles.set(entry, await bundle(resolve('packages/web/src/' + entry + '.ts'))),
    ),
  );
}, 30000);

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
  describe(name + ' optional animation authoring', () => {
    it.each(['lean-first', 'animation-first', 'complete-hooks', 'complete-then-lean'])(
      '%s preserves canonical output and recovers retained sources',
      async (order) => {
        expect(existsSync(executablePath)).toBe(true);
        const browser = await engine.launch({ executablePath, headless: true });
        try {
          const page = await browser.newPage();
          await page.setContent('<anima-icon paused></anima-icon>');
          const add = async (entry: string) => {
            await page.addScriptTag({ type: 'module', content: bundles.get(entry)! });
            await page.waitForFunction((entry) => {
              const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
              return (
                Icon &&
                (entry === 'index' ||
                  (entry === 'markup'
                    ? !!Icon.compiler
                    : ['data', 'motion'].includes(entry)
                      ? Icon.modules.has(entry)
                      : !!Icon.markupHooks.animation))
              );
            }, entry);
          };
          if (order === 'lean-first') {
            await add('markup');
            expect(
              await page.evaluate(
                (source) =>
                  (customElements.get('anima-icon') as typeof AnimaIcon).compiler!(source)
                    .diagnostics,
                wrap(''),
              ),
            ).toEqual([]);
            for (const [child, pointer] of missing) {
              const result = await page.evaluate(
                (source) =>
                  (customElements.get('anima-icon') as typeof AnimaIcon).compiler!(source),
                wrap(child),
              );
              expect(result.doc).toBeUndefined();
              expect(result.diagnostics).toEqual([
                expect.objectContaining({
                  code: 'markup-animation-unavailable',
                  pointer,
                  message: 'load @anima-format/web/markup-animation or run anima build',
                  hint: 'load @anima-format/web/markup-animation or run anima build',
                  line: 1,
                  column: expect.any(Number),
                }),
              ]);
              expect(result.diagnostics[0]!.column).toBeGreaterThan(1);
            }
            const diagnostics = await page.evaluate(
              (source) => (document.querySelector('anima-icon') as AnimaIcon).load(source, true),
              bell,
            );
            expect(diagnostics.some((d) => d.code === 'markup-animation-unavailable')).toBe(true);
            await add('markup-animation');
            await page.evaluate(async () => {
              await (document.querySelector('anima-icon') as AnimaIcon).ready;
            });
            await page.waitForFunction(
              () => !!(document.querySelector('anima-icon') as AnimaIcon).player,
            );
          } else await add(order === 'animation-first' ? 'markup-animation' : 'markup-hooks');
          if (order === 'complete-then-lean') {
            await add('data');
            await add('motion');
            await add('markup');
            const keys = await page.evaluate(
              (source) => (customElements.get('anima-icon') as typeof AnimaIcon).compiler!(source),
              keyed,
            );
            expect(keys.diagnostics).toEqual([]);
            expect(keys.doc).toEqual(keyedExpected);
          }
          if (order === 'animation-first') await add('markup');
          const result = await page.evaluate(
            async (source) => {
              const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
              return {
                sync: Icon.compiler!(source) as ReturnType<typeof compile>,
                async: (await Icon.compilerAsync!(source, 'bell.animl')) as ReturnType<
                  typeof compile
                >,
              };
            },
            order === 'complete-then-lean' ? keyed : bell,
          );
          const expectedText = order === 'complete-then-lean' ? keyedResult.text : expected;
          expect(result.sync.diagnostics).toEqual([]);
          expect(result.async.diagnostics).toEqual([]);
          expect(result.sync.text).toBe(expectedText);
          expect(result.async.text).toBe(expectedText);
        } finally {
          await browser.close();
        }
      },
      30000,
    );
  });
