import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { describe, it, expect } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import { readFileSync } from 'node:fs';
import type {} from '../../../host/web/index.ts';
const SOURCE = readFileSync(new URL('../../examples/scoreboard.animl', import.meta.url), 'utf8');
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
  describe(name + ' derive', () => {
    for (const first of [true, false])
      it(
        'separate bundles; derive first=' + first,
        async () => {
          const executablePath = paths.find((p) => p && existsSync(p));
          if (!executablePath) throw Error('browser absent');
          const browser = await engine.launch({ executablePath, headless: true });
          try {
            const page = await browser.newPage();
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(e.message));
            await page.setContent(
              '<anima-icon auto-bind paused style="display:block;width:100px;height:100px"></anima-icon>',
            );
            for (const mod of [
              'index',
              ...(first
                ? ['derive', 'host', 'convert', 'data', 'bind', 'markup']
                : ['markup', 'bind', 'data', 'convert', 'host', 'derive']),
            ])
              await page.addScriptTag({
                type: 'module',
                content: await bundle(
                  resolve('packages/web/src/' + (mod === 'markup' ? 'markup-hooks' : mod) + '.ts'),
                ),
              });
            await page.waitForFunction(() => {
              const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
              return (
                !!Icon?.compiler &&
                ['derive', 'data', 'bind', 'convert', 'host'].every((m) => Icon.modules.has(m))
              );
            });
            const result = await page.evaluate(async (xml) => {
              const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
              const doc = Icon.compiler!(xml);
              if (!doc.doc) throw Error(JSON.stringify(doc.diagnostics));
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              icon.load(doc.doc);
              const api = icon.data;
              const label = api.string('players.0.label'),
                seen: string[] = [];
              const initial = label.value;
              label.on('change', (v) => seen.push(v));
              api.number('players.0.score').set(1600);
              icon.player!.step(0);
              let code = '';
              try {
                label.set('bad');
              } catch (e) {
                code = (e as { code: string }).code;
              }
              const values = [
                label.value,
                api.string('players.1.label').value,
                icon.player!.value('a.properties.label'),
                icon.player!.value('a.x'),
              ];
              api.list('players').set([
                { name: 'New', score: 2000 },
                { name: 'Lin', score: 980 },
                { name: 'Sam', score: 40 },
              ]);
              icon.player!.step(0);
              const replaced = label.value;
              icon.destroy();
              return { initial, seen, values, code, replaced };
            }, SOURCE);
            expect(result).toEqual({
              initial: '1,250 pts',
              seen: ['1,600 pts', '2,000 pts'],
              values: ['1,600 pts', '980 pts', '1,600 pts', 1],
              code: 'read-only-path',
              replaced: '2,000 pts',
            });
            expect(errors).toEqual([]);
          } finally {
            await browser.close();
          }
        },
        30000,
      );
  });
