import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';

// Rottweiler P3 R1-03: documents whose player is created after asset loading still get the
// browser input listeners.
for (const [name, engine, cache] of [
  [
    'Chromium',
    chromium,
    '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['Firefox', firefox, '.cache/ms-playwright/firefox-1555/firefox/firefox'],
] as const) {
  const executablePath = resolve(homedir(), cache);
  describe.skipIf(!existsSync(executablePath))(name + ' input after asset loading', () => {
    it('attaches keyboard listeners once the asynchronous player exists', async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.setContent('<p>input</p>');
        for (const n of ['index', 'input', 'assets'])
          await page.addScriptTag({
            type: 'module',
            content: await bundle(resolve(`packages/web/src/${n}.ts`)),
          });
        await page.waitForFunction(() =>
          ['input', 'assets'].every((n) =>
            (customElements.get('anima-icon') as typeof AnimaIcon | undefined)?.modules.has(n),
          ),
        );
        const seen = await page.evaluate(async () => {
          const results: unknown[] = [];
          for (const assets of [false, true]) {
            const icon = document.createElement('anima-icon') as AnimaIcon;
            document.body.append(icon);
            icon.load({
              anima: '0.1',
              name: 'key',
              grid: 20,
              requires: assets ? ['input', 'assets'] : ['input'],
              inputs: { seen: { type: 'bool' } },
              nodes: [{ id: 'dot', type: 'circle', center: [2, 2], r: 1, fill: { color: '#000' } }],
              listeners: [{ on: 'key-down', key: 'k', modifiers: 'control', set: { seen: true } }],
              ...(assets ? { assets: {} } : {}),
            });
            await icon.ready;
            icon.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
            );
            icon.player!.step(0);
            results.push(icon.get('seen'));
          }
          return results;
        });
        expect(seen).toEqual([true, true]);
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    }, 30_000);
  });
}
