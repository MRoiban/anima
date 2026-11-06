import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { describe, it, expect } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
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
  describe(name + ' convert', () => {
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
              ...(first
                ? ['convert', 'data', 'bind', 'markup']
                : ['markup', 'bind', 'data', 'convert']),
            ])
              await page.addScriptTag({
                type: 'module',
                content: await bundle(resolve('packages/web/src/' + mod + '.ts')),
              });
            await page.waitForFunction(
              () =>
                !!(customElements.get('anima-icon') as typeof AnimaIcon)?.compiler &&
                ['data', 'bind', 'convert'].every((m) =>
                  (customElements.get('anima-icon') as typeof AnimaIcon).modules.has(m),
                ),
            );
            const result = await page.evaluate(async () => {
              const el = document.querySelector('anima-icon') as AnimaIcon;
              const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
              const xml = `<anima version="0.1" name="browser-convert" grid="20" requires="data bind convert"><model name="Score"><number name="score" default="4"/><number name="bonus" default="2"/></model><converter name="math" type="formula" expression="pow(value, 2) + $bonus"/><converter name="map" type="range" to="0 100"/><converter name="round" type="round"/><converter-group name="pct" chain="map round"/><circle id="dot" cx="10" cy="10" r="1" fill="#000"/><bind target="dot.x" value="$score" convert="math"/><bind target="dot.y" value="$bonus / 100" convert="pct"/><bind target="dot.r" value="sqrt($score)"/></anima>`;
              const compiled = (customElements.get('anima-icon') as typeof AnimaIcon).compiler!(
                xml,
              );
              if (compiled.diagnostics.some((d) => d.severity === 'error'))
                throw Error(JSON.stringify(compiled.diagnostics));
              // The bind parser lives in a different bundle. Its errors must become diagnostics.
              const invalid = Icon.compiler!(xml.replace('sqrt($score)', 'missing($score)'));
              const diagnostic = invalid.diagnostics.find((d) => d.code === 'bind-syntax');
              if (!diagnostic) throw Error(JSON.stringify(invalid.diagnostics));
              await el.load(compiled.doc!);
              el.player!.step(0);
              const before = el.player!.value('dot.x');
              el.player!.set('$score', 9);
              el.player!.set('$bonus', 3);
              el.player!.step(0);
              return {
                before,
                after: el.player!.value('dot.x'),
                radius: el.player!.value('dot.r'),
                pct: el.player!.value('dot.y'),
              };
            });
            expect(result).toEqual({ before: 18, after: 84, radius: 3, pct: 3 });
            expect(errors).toEqual([]);
          } finally {
            await browser.close();
          }
        },
        30000,
      );
  });
