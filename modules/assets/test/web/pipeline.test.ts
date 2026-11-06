import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type BrowserType } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../../media/web/index.ts';
const browsers: [string, BrowserType, string | undefined][] = [
  [
    'Chromium',
    chromium,
    process.env.CHROMIUM_PATH ??
      [
        resolve(
          homedir(),
          '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
        ),
        chromium.executablePath(),
      ].find(existsSync),
  ],
  [
    'Firefox',
    firefox,
    process.env.FIREFOX_PATH ??
      [
        resolve(homedir(), '.cache/ms-playwright/firefox-1555/firefox/firefox'),
        firefox.executablePath(),
      ].find(existsSync),
  ],
];
const tile = new PNG({ width: 2, height: 2 });
tile.data.set([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]);
const uri = 'data:image/png;base64,' + PNG.sync.write(tile).toString('base64');
for (const [name, type, executablePath] of browsers)
  describe.skipIf(!executablePath)(name + ' asset pipeline', () => {
    it('enforces local policy; provides detached metadata and lazy cached blob/audio bytes through the resolver', async () => {
      const browser = await type.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.route('https://anima.test/**', (route) =>
          route.fulfill({ contentType: 'text/html', body: '<anima-icon paused></anima-icon>' }),
        );
        await page.goto('https://anima.test/');
        await page.addScriptTag({
          type: 'module',
          content: await bundle(resolve('packages/web/src/media.ts')),
        });
        const result = await page.evaluate(async (uri) => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const doc = {
            anima: '0.1',
            name: 'media',
            grid: 8,
            requires: ['assets'],
            assets: {
              bytes: {
                type: 'blob',
                source: 'data:application/octet-stream;base64,AQID',
                size: 3,
                mime: 'application/octet-stream',
                metadata: { credit: 'self' },
              },
              tone: { type: 'audio', source: 'data:audio/wav;base64,AQID' },
              picture: { type: 'image', source: uri },
            },
            nodes: [{ id: 'probe', type: 'circle', center: [4, 4], r: 1 }],
          };
          const done = new Promise<void>((res) =>
            icon.addEventListener('anima:load', () => res(), { once: true }),
          );
          icon.load(doc);
          await done;
          const local = icon.assetPolicy;
          let rejected = false;
          try {
            await icon.resolveAsset('offsite', { type: 'blob', source: 'https://cdn.test/x' });
          } catch {
            rejected = true;
          }
          icon.assetPolicy = 'any';
          const allowed = await icon.resolveAsset('offsite', {
            type: 'blob',
            source: 'https://cdn.test/x',
          });
          icon.assetPolicy = 'local';
          const seen: unknown[] = [];
          icon.assets = (name, info) => {
            seen.push([name, info.type, info.source, info.size, info.mime]);
            if (info.metadata) info.metadata.credit = 'mutated';
            return new Blob([new Uint8Array([4, 5, 6])]);
          };
          const first = icon.asset('bytes'),
            second = icon.asset('bytes');
          const data = await first;
          const tone = await icon.asset('tone');
          return {
            local,
            rejected,
            allowed,
            same: first === second,
            bytes: Array.from(new Uint8Array(data as ArrayBuffer)),
            tone: Array.from(new Uint8Array(tone as ArrayBuffer)),
            seen,
            credit: doc.assets.bytes.metadata.credit,
            picture: (await icon.asset('picture')) === uri,
          };
        }, uri);
        expect(result).toEqual({
          local: 'local',
          rejected: true,
          allowed: 'https://cdn.test/x',
          same: true,
          bytes: [4, 5, 6],
          tone: [4, 5, 6],
          seen: [
            [
              'bytes',
              'blob',
              'data:application/octet-stream;base64,AQID',
              3,
              'application/octet-stream',
            ],
            ['tone', 'audio', 'data:audio/wav;base64,AQID', undefined, undefined],
          ],
          credit: 'self',
          picture: true,
        });
      } finally {
        await browser.close();
      }
    });
    it('host-decodes original WAV bytes without consuming the cached buffer', async () => {
      const source =
        'data:audio/wav;base64,' +
        readFileSync(new URL('../../probes/import-formats/tone.wav', import.meta.url)).toString(
          'base64',
        );
      const browser = await type.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent('<anima-icon paused></anima-icon>');
        await page.addScriptTag({
          type: 'module',
          content: await bundle(resolve('packages/web/src/media.ts')),
        });
        const result = await page.evaluate(async (source) => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const done = new Promise<void>((resolve) =>
            icon.addEventListener('anima:load', () => resolve(), { once: true }),
          );
          icon.load({
            anima: '0.1',
            name: 'wav',
            grid: 8,
            requires: ['assets'],
            assets: { tone: { type: 'audio', source } },
            nodes: [{ id: 'probe', type: 'circle', center: [4, 4], r: 1 }],
          });
          await done;
          const bytes = await icon.asset('tone');
          if (typeof bytes === 'string') throw Error('expected bytes');
          const decoded = await new OfflineAudioContext(1, 1, 8000).decodeAudioData(bytes.slice(0));
          return {
            length: decoded.length,
            rate: decoded.sampleRate,
            duration: decoded.duration,
            first: decoded.getChannelData(0)[0],
            second: decoded.getChannelData(0)[1],
            cached: bytes.byteLength,
          };
        }, source);
        expect(result).toEqual({
          length: 800,
          rate: 8000,
          duration: 0.1,
          first: 0,
          second: -1,
          cached: 844,
        });
      } finally {
        await browser.close();
      }
    });
    it.each(['svg', 'canvas'])(
      'matches independently enumerated repeat/mirror/clamp texels in %s, including axis overrides and resize',
      async (renderer) => {
        const browser = await type.launch({ executablePath, headless: true });
        try {
          const page = await browser.newPage({ deviceScaleFactor: 1 });
          await page.setContent(
            '<style>body{margin:0}anima-icon{display:block;width:80px;height:80px}</style><anima-icon paused></anima-icon>',
          );
          await page.addScriptTag({
            type: 'module',
            content: await bundle(resolve('packages/web/src/index.ts')),
          });
          for (const entry of ['paint-sampling', 'assets', 'canvas'])
            await page.addScriptTag({
              type: 'module',
              content: await bundle(resolve('packages/web/src/' + entry + '.ts')),
            });
          // One intrinsic pixel = ten screen pixels. Sample at texel centres, away from all edges.
          for (const mode of [
            'repeat',
            'mirror',
            'clamp',
            'axes',
            'resize',
            ...(renderer === 'canvas' ? ['bilinear'] : []),
          ]) {
            const doc = {
              anima: '0.1',
              name: 'sample',
              grid: 8,
              requires: ['assets', 'paint'],
              assets: { tile: { type: 'image', source: uri, width: 2, height: 2 } },
              nodes: [
                {
                  id: 'tile',
                  type: 'image',
                  asset: 'tile',
                  x0: 0,
                  y0: 0,
                  width: mode === 'bilinear' ? 8.125 : 8,
                  height: mode === 'bilinear' ? 8.125 : 8,
                  fit: mode === 'resize' ? 'resize' : 'none',
                  align: mode === 'bilinear' ? 'center' : 'top-left',
                  sampling: mode === 'bilinear' ? 'bilinear' : 'nearest',
                  wrap:
                    mode === 'axes' || mode === 'bilinear'
                      ? 'repeat'
                      : mode === 'resize'
                        ? 'clamp'
                        : mode,
                  ...(mode === 'axes' ? { wrapX: 'mirror', wrapY: 'clamp' } : {}),
                },
              ],
            };
            await page.evaluate(
              async ({ doc, renderer }) => {
                const icon = document.querySelector('anima-icon') as AnimaIcon;
                icon.style.width = icon.style.height =
                  doc.nodes[0]!.sampling === 'bilinear' ? '64px' : '80px';
                icon.setAttribute('renderer', renderer);
                const done = new Promise<void>((res, rej) => {
                  icon.addEventListener('anima:load', () => res(), { once: true });
                  icon.addEventListener('anima:error', (e) => rej((e as CustomEvent).detail), {
                    once: true,
                  });
                });
                const ds = icon.load(doc);
                if (ds.some((d) => d.severity === 'error')) throw ds;
                await done;
              },
              { doc, renderer },
            );
            const shot = PNG.sync.read(await page.locator('anima-icon').screenshot());
            // Bilinear: 64px / 8 units gives a binary-exact 1/16-unit pixel centre.
            // The 8.125-unit centred box places the image at 3.0625: pixel (8*x,8*y)
            // samples integer texture coordinates, averaging all four periodic texels.
            for (let y = 0; y < 8; y++)
              for (let x = 0; x < 8; x++) {
                const mx = mode === 'mirror' || mode === 'axes',
                  my = mode === 'mirror';
                const tx =
                    mode === 'resize' ? Math.floor(x / 4) : mx ? [0, 1, 1, 0][x % 4]! : x % 2,
                  ty = mode === 'resize' ? Math.floor(y / 4) : my ? [0, 1, 1, 0][y % 4]! : y % 2;
                const empty =
                  (mode === 'clamp' && (x >= 2 || y >= 2)) || (mode === 'axes' && y >= 2);
                const expected =
                  mode === 'bilinear'
                    ? [128, 128, 64]
                    : empty
                      ? [255, 255, 255]
                      : Array.from(tile.data.slice((ty * 2 + tx) * 4, (ty * 2 + tx) * 4 + 3));
                const p =
                  mode === 'bilinear'
                    ? (y * 8 * shot.width + x * 8) * 4
                    : ((y * 10 + 5) * shot.width + x * 10 + 5) * 4;
                const actual = Array.from(shot.data.slice(p, p + 3));
                if (mode === 'bilinear')
                  for (const [channel, value] of expected.entries())
                    expect(
                      Math.abs(actual[channel]! - value),
                      `${renderer}/${mode}/${x},${y}: ${actual}`,
                    ).toBeLessThanOrEqual(2);
                else expect(actual, `${renderer}/${mode}/${x},${y}`).toEqual(expected);
              }
          }
        } finally {
          await browser.close();
        }
      },
    );
  });
