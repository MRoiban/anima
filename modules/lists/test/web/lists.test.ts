import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { describe, it, expect } from 'vitest';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';

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
  describe(name + ' lists', () => {
    for (const first of [true, false])
      it(
        'retains state, DOM and contexts across reorder; lists first=' + first,
        async () => {
          const executablePath = paths.find((p) => p && existsSync(p));
          if (!executablePath) throw Error('browser absent');
          const browser = await engine.launch({ executablePath, headless: true });
          try {
            const page = await browser.newPage();
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(e.message));
            await page.setContent(
              '<anima-icon style="display:block;width:300px;height:300px"></anima-icon>',
            );
            const mods = first
              ? [
                  'lists',
                  'components',
                  'data',
                  'bind',
                  'markup-components',
                  'markup',
                  'paint',
                  'composite',
                  'markup-paint',
                ]
              : [
                  'paint',
                  'composite',
                  'components',
                  'bind',
                  'data',
                  'markup',
                  'markup-components',
                  'markup-paint',
                  'lists',
                ];
            for (const mod of ['index', ...mods])
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
                ['lists', 'components', 'data', 'bind'].every((m) => Icon.modules.has(m)) &&
                !!Icon.markupHooks.components
              );
            });
            const xml = readFileSync(
              new URL('../../examples/players.animl', import.meta.url),
              'utf8',
            )
              .replace(
                'requires="components data bind lists"',
                'requires="components data bind lists paint composite"',
              )
              .replace(
                '<circle id="dot" cx="2" cy="2" r="1" fill="#000"/>',
                '<circle id="clip" cx="2" cy="2" r="9" fill="#fff"/><circle id="dot" cx="2" cy="2" r="1"><clip source="clip"/><linearGradient x1="0" y1="0" x2="10" y2="0"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient></circle>',
              );
            const got = await page.evaluate((xml) => {
              const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              const errors = icon.load(xml, true);
              if (errors.some((d) => d.severity === 'error')) throw Error(JSON.stringify(errors));
              const p = icon.player!;
              const module = Icon.modules.get('lists') as unknown as {
                listState(p: unknown): { runs: { items: { player: unknown }[] }[] };
              };
              const data = Icon.modules.get('data') as unknown as {
                dataState(p: unknown): { read(path: string): unknown };
              };
              const run = module.listState(p).runs[0]!;
              const first = run.items[0]!.player,
                second = run.items[1]!.player;
              const before = icon.shadowRoot!.querySelector('g[id$="rows/0/dot"] circle');
              const initial = before?.getAttribute('r');
              const list = data.dataState(p).read('$players') as object[];
              list.reverse();
              p.step(0.25);
              icon.frame(1000);
              const swapped = icon.shadowRoot!.querySelector('g[id$="rows/0/dot"] circle');
              const result = {
                initial,
                gradients: icon.shadowRoot!.querySelectorAll('linearGradient').length,
                clips: icon.shadowRoot!.querySelectorAll('clipPath').length,
                gradientFill: swapped?.getAttribute('fill'),
                after: swapped?.getAttribute('r'),
                retained: before === icon.shadowRoot!.querySelector('g[id$="rows/1/dot"] circle'),
                players: run.items[0]!.player === second && run.items[1]!.player === first,
                values: p.values(),
                errors,
              };
              const removed = list.pop()!;
              p.step(0);
              icon.frame(1001);
              const afterRemoval = [
                icon.shadowRoot!.querySelectorAll('linearGradient').length,
                icon.shadowRoot!.querySelectorAll('clipPath').length,
              ];
              list.push(removed);
              p.step(0);
              icon.frame(1002);
              const afterInsert = [
                icon.shadowRoot!.querySelectorAll('linearGradient').length,
                icon.shadowRoot!.querySelectorAll('clipPath').length,
              ];
              const sameRoot = icon.player === p;
              icon.destroy();
              return { ...result, afterRemoval, afterInsert, sameRoot };
            }, xml);
            expect(got.afterRemoval).toEqual([1, 1]);
            expect(got.afterInsert).toEqual([2, 2]);
            expect(got.sameRoot).toBe(true);
            expect(got.gradients).toBe(2);
            expect(got.clips).toBe(2);
            expect(got.gradientFill).toMatch(/^url\(#a\d+-p/);
            expect(got.initial).toBe('3');
            expect(got.after).toBe('7');
            expect(got.retained).toBe(true);
            expect(got.players).toBe(true);
            expect(got.values).toMatchObject({
              'rows/0/dot.r': 7,
              'rows/1/dot.r': 3,
              'rows/0/dot.x': 0,
              'rows/1/dot.y': 2,
            });
            expect(errors).toEqual([]);
          } finally {
            await browser.close();
          }
        },
        30000,
      );
  });
