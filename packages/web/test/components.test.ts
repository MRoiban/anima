import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { describe, it, expect } from 'vitest';
import type { AnimaIcon } from '../src/index.ts';
import { cachedBundle as bundle } from '../../../tools/browser-cache.ts';

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
  describe(name + ' components', () => {
    it('renders scoped instances and routes a pointer event that changes the parent', async () => {
      const executablePath = paths.find((p) => p && existsSync(p));
      if (!executablePath) throw Error('browser absent');
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent(
          '<anima-icon style="display:block;width:200px;height:200px"></anima-icon>',
        );
        // Separate emitted bundles must share the base runtime's loader/player/module registry.
        for (const entry of ['index', 'components', 'bind', 'markup'])
          await page.addScriptTag({
            type: 'module',
            content: await bundle(resolve('packages/web/src/' + entry + '.ts')),
          });
        await page.evaluate(
          async (doc) => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            const diagnostics = icon.load(doc);
            if (diagnostics.some((d) => d.severity === 'error'))
              throw Error(JSON.stringify(diagnostics));
          },
          JSON.parse(readFileSync(resolve('examples/toolbar.ani'), 'utf8')),
        );
        await expect
          .poll(() =>
            page.evaluate(() => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              return icon.shadowRoot!.querySelector('g[id$="badge/dot"] circle')?.getAttribute('r');
            }),
          )
          .toBe('3');
        const box = await page.locator('anima-icon').boundingBox();
        await page.mouse.click(box!.x + 160, box!.y + 40);
        await expect
          .poll(() =>
            page.evaluate(() => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              return { states: icon.player!.states(), unread: icon.player!.get('unread') };
            }),
          )
          .toMatchObject({ states: { toolbar: 'read', 'badge/badge': 'cleared' }, unread: 0 });
        const result = await page.evaluate(() => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          return {
            r: icon.shadowRoot!.querySelector('g[id$="badge/dot"] circle')?.getAttribute('r'),
            states: icon.player!.inspect().map((s) => s.layer),
          };
        });
        expect(result.r).toBe('0');
        expect(result.states).toContain('bell/press');
        expect(result.states).toContain('badge/badge');
        await page.evaluate(() => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const diagnostics = icon.load(
            `<anima version="0.1" name="inline" grid="20" requires="components bind"><number name="unread" default="3"/><component name="badge" grid="8"><number name="count"/><circle id="dot" cx="4" cy="4" r="1" fill="#f00"/><bind target="dot.r" value="count"/><listener on="click" emit="selected"/></component><instance id="b" component=" badge " count="{unread}"/><listener on="b.selected" set="unread=0"/></anima>`,
            true,
          );
          if (diagnostics.some((d) => d.severity === 'error'))
            throw Error(JSON.stringify(diagnostics));
          if (icon.player!.value('b/dot.r') !== 3)
            throw Error('separate markup/component registries diverged');
        });
      } finally {
        await browser.close();
      }
    }, 30000);
  });
