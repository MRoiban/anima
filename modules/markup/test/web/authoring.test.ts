import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { beforeAll, describe, expect, it } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';

const runtime = [
  'paint',
  'surface',
  'components',
  'bind',
  'convert',
  'events',
  'focus',
  'motion',
  'data',
  'assets',
  'input',
];
const entries = ['index', 'markup-hooks', ...runtime];
const bundles = new Map<string, string>();
const examples = [
  'examples/paint',
  'examples/slice',
  'examples/feather',
  'modules/convert/examples/score',
  'modules/events/examples/share',
  'modules/focus/examples/traversal',
  'modules/motion/examples/sync',
  'modules/data/examples/scoreboard',
].map((file) => ({
  source: readFileSync(file + '.animl', 'utf8'),
  doc: JSON.parse(readFileSync(file + '.ani', 'utf8')) as unknown,
}));
// A component needs its own compiler hook, independently of structural/data forms.
const component = `<anima version="0.1" name="component" grid="8" requires="components bind">
  <component name="badge" grid="8"><number name="count" default="2"/>
    <circle id="dot" cx="4" cy="4" r="1"/><bind target="dot.r" value="count"/>
  </component><instance id="badge" component="badge" count="3"/>
</anima>`;

beforeAll(async () => {
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
  describe(name + ' authoring entry registration', () => {
    it.each(['authoring-first', 'authoring-last', 'reversed', 'reversed-authoring-first'])(
      '%s: runtime-only registration; synchronous hooks and identical AniML documents',
      async (order) => {
        const executablePath = paths.find((path) => path && existsSync(path));
        if (!executablePath) throw Error('browser absent');
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
                  (entry === 'markup-hooks' ? !!Icon.compiler : Icon.modules.has(entry)))
              );
            }, entry);
          };
          await add('index');
          if (order.endsWith('first')) await add('markup-hooks');
          for (const entry of order.startsWith('reversed') ? [...runtime].reverse() : runtime) {
            await add(entry);
            if (order.endsWith('first')) {
              // The authoring dispatch is synchronous: a module is usable before the next import.
              expect(
                await page.evaluate((entry) => {
                  const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
                  const slot = entry === 'focus' ? 'paint' : entry;
                  return ['surface', 'assets', 'input'].includes(entry) || !!Icon.markupHooks[slot];
                }, entry),
              ).toBe(true);
            }
          }
          if (!order.endsWith('first')) {
            expect(
              await page.evaluate(() =>
                Object.keys((customElements.get('anima-icon') as typeof AnimaIcon).markupHooks),
              ),
            ).toEqual([]);
            await add('markup-hooks');
          }
          const result = await page.evaluate(
            async ({ sources, component }) => {
              const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
              const sync = sources.map((source) => Icon.compiler!(source));
              const asyncResults = await Promise.all(
                sources.map((source) =>
                  Icon.compilerAsync!(source, 'https://anima.test/example.animl'),
                ),
              );
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              const diagnostics = icon.load(component, true);
              icon.player?.step(0);
              return { sync, asyncResults, diagnostics, radius: icon.player?.value('badge/dot.r') };
            },
            { sources: examples.map((example) => example.source), component },
          );
          expect(result.sync.map((r) => r.diagnostics)).toEqual(examples.map(() => []));
          expect(result.sync.map((r) => r.doc)).toEqual(examples.map((example) => example.doc));
          expect(result.asyncResults).toEqual(result.sync);
          expect(result.diagnostics).toEqual([]);
          expect(result.radius).toBe(3);
        } finally {
          await browser.close();
        }
      },
      30000,
    );
  });
