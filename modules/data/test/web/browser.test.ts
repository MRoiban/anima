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
              const xml = `<anima version="0.1" name="browser-data" grid="20" requires="data bind"><model name="Score"><number name="score" default="4"/><string name="label" default="Ada"/></model><circle id="dot" cx="10" cy="10" r="1" data-label="start" fill="#000"/><bind target="dot.r" value="$score"/><bind target="dot.properties.label" value="$label"/></anima>`;
              const compiled = (customElements.get('anima-icon') as typeof AnimaIcon).compiler!(
                xml,
              );
              if (compiled.diagnostics.some((d) => d.severity === 'error'))
                throw Error(JSON.stringify(compiled.diagnostics));
              await el.load(compiled.doc!);
              el.player!.step(0);
              const before = el.player!.value('dot.r');
              el.player!.set('$score', 8);
              el.player!.set('$label', 'Grace');
              el.player!.step(0);
              return {
                before,
                after: el.player!.value('dot.r'),
                label: el.player!.value('dot.properties.label'),
              };
            });
            expect(result).toEqual({ before: 4, after: 8, label: 'Grace' });
            expect(errors).toEqual([]);
          } finally {
            await browser.close();
          }
        },
        30000,
      );
  });
