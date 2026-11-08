import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../../host/web/index.ts';

// Rottweiler P3 web host API: R3-02 detached `info` defaults, R3-07 direct asset-name writes
// supersede a pending URL replacement, R3-09 `invalidate()` on an empty host with composite.
const svg = (n: number) =>
  `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22${n}%22 height=%22${n}%22/%3E`;
for (const [name, engine, cache] of [
  [
    'Chromium',
    chromium,
    '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['Firefox', firefox, '.cache/ms-playwright/firefox-1555/firefox/firefox'],
] as const) {
  const executablePath = resolve(homedir(), cache);
  describe.skipIf(!existsSync(executablePath))(name + ' web host API (Rottweiler P3)', () => {
    it('keeps info detached, lets later asset names win and ignores empty invalidate', async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        // Asset sources resolve against the document base (about:blank cannot be a base).
        await page.setContent('<head><base href="http://localhost/"></head><body></body>');
        await page.addScriptTag({
          type: 'module',
          content: await bundle(resolve('modules/host-edit/test/web/p3-entry.ts')),
        });
        await page.waitForFunction(() =>
          ['composite', 'data', 'hostedit', 'assets'].every((n) =>
            (customElements.get('anima-icon') as typeof AnimaIcon | undefined)?.modules.has(n),
          ),
        );
        const result = await page.evaluate(
          async ([first, second, third]) => {
            const make = () => {
              const i = document.createElement('anima-icon') as AnimaIcon;
              i.pause();
              document.body.append(i);
              return i;
            };
            const nodes = [
              { id: 'a', type: 'circle', center: [2, 2], r: 1, fill: { color: '#000' } },
            ];
            const empty = make();
            let invalidate = 'ok';
            try {
              empty.invalidate();
            } catch (e) {
              invalidate = (e as Error).message;
            }
            empty.destroy();
            const color = make();
            color.load({
              anima: '0.1',
              name: 'color',
              grid: 20,
              requires: ['data'],
              data: {
                models: { M: { properties: { tint: { type: 'color', default: '#112233' } } } },
              },
              nodes,
            });
            const input = color.info!.inputs.find((i) => i.type === 'color')!;
            (input.default as number[])[0] = 255;
            const other = make();
            other.loadModel(color.player!.model);
            const tints = [color.get(input.name), other.get(input.name)];
            other.destroy();
            color.destroy();
            const image = make();
            const loaded = new Promise((r) =>
              image.addEventListener('anima:load', r, { once: true }),
            );
            image.load({
              anima: '0.1',
              name: 'image',
              grid: 20,
              requires: ['assets', 'data', 'host', 'hostedit'],
              assets: {
                first: { type: 'image', source: first },
                second: { type: 'image', source: second },
              },
              data: {
                models: {
                  M: {
                    properties: {
                      photo: { type: 'asset-ref', assetType: 'image', default: 'first' },
                    },
                  },
                },
              },
              nodes,
            });
            await loaded;
            const decode = Image.prototype.decode;
            let decoded!: () => void;
            Image.prototype.decode = () => new Promise<void>((r) => (decoded = r));
            const handle = image.player!.data.image('$default:photo');
            const pending = handle.set(third);
            handle.set('second');
            image.player!.step(0);
            decoded();
            await pending;
            image.player!.step(0);
            Image.prototype.decode = decode;
            const photo = handle.value;
            image.destroy();
            return { invalidate, tints, photo };
          },
          [svg(1), svg(2), svg(3)],
        );
        expect(result.invalidate).toBe('ok');
        expect(result.tints).toEqual([
          [17, 34, 51, 255],
          [17, 34, 51, 255],
        ]);
        expect(result.photo).toBe('second');
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    }, 30_000);
  });
}
