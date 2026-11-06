import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
const source = readFileSync(
  new URL('../../../../spec/conformance/machine-change-increased/case.ani', import.meta.url),
  'utf8',
);
const xml = readFileSync(
  new URL('../../../../spec/conformance/machine-change-increased/case.animl', import.meta.url),
  'utf8',
);
const lifecycle = readFileSync(
  new URL('../../../../spec/conformance/machine-event-lifecycle/case.animl', import.meta.url),
  'utf8',
);
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
  describe(name + ' machine', () => {
    for (const markupFirst of [false, true])
      it(
        'separate bundles and generic AniML fields; markup first=' + markupFirst,
        async () => {
          const executablePath = paths.find((p) => p && existsSync(p));
          if (!executablePath) throw Error('browser absent');
          const browser = await engine.launch({ executablePath, headless: true });
          try {
            const page = await browser.newPage();
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(e.message));
            await page.setContent(
              '<anima-icon style="width:200px;height:200px;display:block"></anima-icon>',
            );
            await page.evaluate(() => {
              let queue: FrameRequestCallback[] = [],
                now = 0;
              window.requestAnimationFrame = (cb) => queue.push(cb);
              performance.now = () => now;
              (window as unknown as { tick(): void }).tick = () => {
                now += 16;
                const old = queue;
                queue = [];
                old.forEach((cb) => cb(now));
              };
            });
            await page.addScriptTag({
              type: 'module',
              content: await bundle(resolve('packages/web/src/index.ts')),
            });
            await page.evaluate(() => customElements.whenDefined('anima-icon'));
            for (const mod of markupFirst ? ['markup', 'machine'] : ['machine', 'markup'])
              await page.addScriptTag({
                type: 'module',
                content: await bundle(resolve('packages/web/src/' + mod + '.ts')),
              });
            await page.waitForFunction(
              () =>
                (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('machine') &&
                !!(customElements.get('anima-icon') as typeof AnimaIcon).compiler,
              undefined,
              { polling: 10 },
            );
            const result = await page.evaluate(
              async ({ source, xml }) => {
                const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
                const compiled = Icon.compiler!(xml);
                const icon = document.querySelector('anima-icon') as AnimaIcon;
                await icon.load(JSON.parse(source));
                const tick = () => (window as unknown as { tick(): void }).tick();
                tick();
                tick();
                const before = icon.player!.value('dot.x');
                icon.set('count', 100);
                const queued = icon.player!.value('dot.x');
                tick();
                const after = icon.player!.value('dot.x');
                tick();
                return {
                  before,
                  queued,
                  after,
                  busy: icon.player!.busy,
                  diagnostics: compiled.diagnostics,
                  hasChange: JSON.stringify(compiled.doc).includes('increased'),
                };
              },
              { source, xml },
            );
            expect(result).toEqual({
              before: 0,
              queued: 0,
              after: 10,
              busy: false,
              diagnostics: [],
              hasChange: true,
            });
            // Recompose independently emitted modules in opposite orders, after machine.
            for (const mod of markupFirst
              ? ['components', 'events', 'bind']
              : ['bind', 'events', 'components'])
              await page.addScriptTag({
                type: 'module',
                content: await bundle(resolve('packages/web/src/' + mod + '.ts')),
              });
            await page.waitForFunction(() =>
              ['components', 'events', 'bind'].every((m) =>
                (customElements.get('anima-icon') as typeof AnimaIcon).modules.has(m),
              ),
            );
            const actions = await page.evaluate((xml) => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              icon.setAttribute('paused', '');
              const diagnostics = icon.load(xml, true);
              if (!icon.player) throw Error(JSON.stringify(diagnostics));
              const p = icon.player;
              const first = p.step(0);
              const early = [p.get('count'), p.get('seen')];
              p.step(0);
              const next = p.get('seen');
              p.fire('go');
              const transition = p.step(0).events.map((e) => e.name);
              const entry = p.step(0).events.find((e) => e.name === 'arrived')?.payload;
              const completion = p.step(0.0999999995).events.map((e) => e.name);
              const last = p.step(0);
              return {
                diagnostics,
                first: first.events.map((e) => e.name),
                early,
                next,
                transition,
                entry,
                completion,
                count: p.get('count'),
                seen: p.get('seen'),
                settled: last.settled,
              };
            }, lifecycle);
            expect(actions).toEqual({
              diagnostics: [],
              first: ['entered'],
              early: [1, 0],
              next: 11,
              transition: ['@state-end', '@transition-start', 'started'],
              entry: { count: 2 },
              completion: ['@transition-end', 'finished'],
              count: 3,
              seen: 22,
              settled: true,
            });
            expect(errors).toEqual([]);
          } finally {
            await browser.close();
          }
        },
        30000,
      );
  });
