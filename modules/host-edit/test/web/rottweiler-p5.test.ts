import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { describe, it, expect } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../web/index.ts';
import type {} from '../../../host/web/index.ts';

// Rottweiler P5 R1-04: a static image paint (no asset binding) follows a per-player replacement.
for (const [name, engine, executablePath] of [
  [
    'Chromium',
    chromium,
    resolve(
      homedir(),
      '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
    ),
  ],
  ['Firefox', firefox, resolve(homedir(), '.cache/ms-playwright/firefox-1555/firefox/firefox')],
] as const)
  describe.skipIf(!existsSync(executablePath))(name + ' host-edit image paint', () => {
    it('replaces a static image paint per player', async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.setContent('<base href="http://anima.test/"><p></p>');
        for (const mod of ['index', 'data', 'host', 'host-edit', 'assets', 'paint', 'surface'])
          await page.addScriptTag({
            type: 'module',
            content: await bundle(resolve('packages/web/src/' + mod + '.ts')),
          });
        const result = await page.evaluate(async () => {
          const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
          await Icon.ready;
          const png = (color: string) => {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 2;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 2, 2);
            return canvas.toDataURL();
          };
          const red = png('#ff0000'),
            blue = png('#0000ff');
          const doc = {
            anima: '0.1',
            name: 'paint-replace',
            grid: 24,
            requires: ['assets', 'paint', 'surface', 'data'],
            assets: { tile: { type: 'image', source: red, width: 2, height: 2 } },
            data: {
              models: {
                Root: {
                  properties: { pic: { type: 'asset-ref', assetType: 'image', default: 'tile' } },
                },
              },
              model: 'Root',
            },
            nodes: [
              {
                id: 'box',
                type: 'rect',
                x0: 0,
                y0: 0,
                w: 20,
                h: 20,
                fill: { type: 'image', asset: 'tile', imageWidth: 2, imageHeight: 2 },
              },
            ],
          };
          const icons = [0, 1].map(() => {
            const icon = document.createElement('anima-icon') as AnimaIcon;
            icon.setAttribute('auto-bind', '');
            icon.setAttribute('paused', '');
            document.body.append(icon);
            icon.load(doc);
            return icon;
          });
          await Promise.all(icons.map((icon) => icon.ready));
          const [icon, other] = icons as [AnimaIcon, AnimaIcon];
          const href = (i: AnimaIcon) => {
            i.player!.step(0);
            i.invalidate();
            return [...i.shadowRoot!.querySelectorAll('image')].map((e) => e.getAttribute('href'));
          };
          const before = href(icon);
          await icon.data.image('pic').set(blue);
          return {
            before: before.length > 0 && before.every((h) => h === red),
            after: href(icon).every((h) => h === blue),
            other: href(other).every((h) => h === red),
          };
        });
        expect(result).toEqual({ before: true, after: true, other: true });
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    }, 30000);
  });
