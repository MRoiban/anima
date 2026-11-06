import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { describe, it, expect } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { DataModule } from '../../core/index.ts';
import type { bind } from '../../../bind/core/index.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
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
  describe(name + ' data', () => {
    for (const first of [true, false])
      it(
        'loads separate runtime/markup bundles, data first=' + first,
        async () => {
          const executablePath = paths.find((p) => p && existsSync(p));
          if (!executablePath) throw Error('browser absent');
          const browser = await engine.launch({ executablePath, headless: true });
          try {
            const page = await browser.newPage();
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(e.message));
            await page.setContent(
              '<anima-icon style="display:block;width:100px;height:100px"></anima-icon>',
            );
            for (const mod of [
              'index',
              ...(first ? ['data', 'bind', 'markup'] : ['markup', 'bind', 'data']),
            ])
              await page.addScriptTag({
                type: 'module',
                content: await bundle(resolve('packages/web/src/' + mod + '.ts')),
              });
            await page.waitForFunction(
              () =>
                !!(customElements.get('anima-icon') as typeof AnimaIcon)?.compiler &&
                ['data', 'bind'].every((m) =>
                  (customElements.get('anima-icon') as typeof AnimaIcon).modules.has(m),
                ),
            );
            const result = await page.evaluate(async () => {
              const el = document.querySelector('anima-icon') as AnimaIcon;
              const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
              (Icon.modules.get('bind') as typeof bind).registerFunction('triple', 1, (v) => 3 * v);
              (Icon.modules.get('data') as DataModule).registerConverter(
                'offset',
                (v, options) => Number(v) + Number(options.bonus),
              );
              const xml = `<anima version="0.1" name="browser-data" grid="20" requires="data bind"><model name="Score"><number name="score" default="4"/><string name="label" default="Ada"/></model><instance name="main" model="Score" default="true"/><circle id="dot" cx="10" cy="10" r="1" data-label="start" fill="#000"/><bind target="dot.r" value="triple($main:score)" convert="offset" options="{&quot;bonus&quot;:5}"/><bind target="dot.properties.label" value="$label"/></anima>`;
              const compiled = (customElements.get('anima-icon') as typeof AnimaIcon).compiler!(
                xml,
              );
              if (compiled.diagnostics.some((d) => d.severity === 'error'))
                throw Error(JSON.stringify(compiled.diagnostics));
              // The bind parser lives in a different bundle. Its errors must become diagnostics.
              const invalid = Icon.compiler!(xml.replace('triple($main:score)', 'missing($score)'));
              const diagnostic = invalid.diagnostics.find((d) => d.code === 'bind-syntax');
              if (!diagnostic) throw Error(JSON.stringify(invalid.diagnostics));
              await el.load(compiled.doc!);
              el.player!.step(0);
              const before = el.player!.value('dot.r');
              el.player!.set('$score', 8);
              el.player!.set('$label', 'Grace');
              el.player!.step(0);
              const original = {
                before,
                after: el.player!.value('dot.r'),
                label: el.player!.value('dot.properties.label'),
              };
              const extras = Icon.compiler!(
                `<anima version="0.1" name="extras" grid="20" requires="data bind"><model name="Root"><bool name="ready"/><number name="level"/><trigger name="pulse"/></model><instance name="main" model="Root" default="true" export="true"/><instance name="private" model="Root"/><circle id="dot" cx="10" cy="10" r="1" fill="#000"/><bind target="$pulse" value="$level"/><layer name="status" initial="idle"><state name="idle"><pose dot.r="1"/><on when="$ready == true" to="armed"/></state><state name="armed"><pose dot.r="3"/><on when="$pulse" to="done"/></state><state name="done"><pose dot.r="5"/></state></layer></anima>`,
              );
              if (extras.diagnostics.some((d) => d.severity === 'error'))
                throw Error(JSON.stringify(extras.diagnostics));
              await el.load(extras.doc!);
              const p = el.player!;
              p.step(0);
              p.set('$ready', true);
              p.step(0);
              const armed = p.value('dot.r');
              p.set('$level', 1);
              p.step(0);
              const queued = p.value('dot.r');
              p.step(0);
              const exports = (Icon.modules.get('data') as DataModule).dataState(p)!.exports();
              return { ...original, armed, queued, done: p.value('dot.r'), exports };
            });
            expect(result).toEqual({
              before: 17,
              after: 29,
              label: 'Grace',
              armed: 3,
              queued: 3,
              done: 5,
              exports: [{ name: 'main', model: 'Root' }],
            });
            expect(errors).toEqual([]);
          } finally {
            await browser.close();
          }
        },
        30000,
      );
  });
