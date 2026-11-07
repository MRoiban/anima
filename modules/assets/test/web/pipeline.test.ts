import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type BrowserType } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Browser } from 'playwright-core';
import { PNG } from 'pngjs';
import { cachedBundle as buildBundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../../media/web/index.ts';
// Cache generated code, not browser state. The shared helper falls back to a
// rebuild when artifacts are stale; repeated calls must not rebuild inside tests.
const bundles = new Map<string, Promise<string>>();
function bundle(entry: string) {
  let result = bundles.get(entry);
  if (!result) bundles.set(entry, (result = buildBundle(entry)));
  return result;
}
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
    // One browser per engine, launched in the hook (as the other browser suites do): launching inside
    // each test put a 1–2 s start-up inside the test's own time limit and timed out under load.
    // Each test gets a fresh context, so pages and caches stay isolated.
    let shared: Browser;
    beforeAll(async () => {
      shared = await type.launch({ executablePath, headless: true });
      await Promise.all(
        [
          'index',
          'media',
          'paint',
          'paint-sampling',
          'assets',
          'canvas',
          'components',
          'data',
          'bind',
          'lists',
        ].map((entry) => bundle(resolve('packages/web/src/' + entry + '.ts'))),
      );
    }, 60000);
    afterAll(async () => {
      await shared?.close();
    });
    it('preloads component-only images relative to src and shares their resolved resources with repeated players', async () => {
      const context = await shared.newContext();
      try {
        const page = await context.newPage();
        await page.route('https://anima.test/**', (route) =>
          route.fulfill({
            contentType: 'text/html',
            body: '<anima-icon paused style="width:80px;height:80px"></anima-icon>',
          }),
        );
        await page.goto('https://anima.test/');
        await page.route('https://anima.test/icons/cover.png', (route) =>
          route.fulfill({
            contentType: 'image/png',
            body: Buffer.from(uri.split(',')[1]!, 'base64'),
          }),
        );
        await page.route('https://anima.test/icons/doc.ani', (route) =>
          route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              anima: '0.1',
              name: 'component-images',
              grid: 8,
              requires: ['assets', 'paint', 'components', 'data', 'bind', 'lists'],
              data: { models: { Board: { properties: { n: { type: 'number', default: 2 } } } } },
              components: {
                row: {
                  grid: 8,
                  assets: { cover: { type: 'image', source: 'cover.png' } },
                  nodes: [
                    {
                      id: 'image',
                      type: 'image',
                      asset: 'cover',
                      x0: 0,
                      y0: 0,
                      width: 4,
                      height: 4,
                      sampling: 'nearest',
                    },
                  ],
                },
              },
              nodes: [{ id: 'rows', type: 'repeat', count: '$n', component: 'row', dx: 4 }],
            }),
          }),
        );
        await Promise.all(
          ['paint', 'assets', 'components', 'data', 'bind', 'lists'].map(async (name) =>
            page.addScriptTag({
              type: 'module',
              content: await bundle(resolve('packages/web/src/' + name + '.ts')),
            }),
          ),
        );
        const hrefs = await page.evaluate(async () => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const loaded = new Promise<void>((resolve, reject) => {
            icon.addEventListener('anima:load', () => resolve(), { once: true });
            icon.addEventListener('anima:error', (e) => reject((e as CustomEvent).detail), {
              once: true,
            });
          });
          icon.setAttribute('src', 'https://anima.test/icons/doc.ani');
          await loaded;
          return [...icon.shadowRoot!.querySelectorAll('image')].map((image) =>
            image.getAttribute('href'),
          );
        });
        expect(hrefs).toEqual([
          'https://anima.test/icons/cover.png',
          'https://anima.test/icons/cover.png',
        ]);
        const pixels = PNG.sync.read(await page.locator('anima-icon').screenshot());
        for (const x of [5, 45])
          expect([
            ...pixels.data.slice((5 * pixels.width + x) * 4, (5 * pixels.width + x) * 4 + 4),
          ]).toEqual([255, 0, 0, 255]);
      } finally {
        await context.close();
      }
    });
    it('enforces local policy; provides detached metadata and lazy cached blob/audio bytes through the resolver', async () => {
      const browser = await shared.newContext();
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
      const browser = await shared.newContext();
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
    it.each(['flac', 'mp3'])(
      'host-decodes genuine %s source with independently known frame counts',
      async (ext) => {
        const source =
          `data:audio/${ext === 'mp3' ? 'mpeg' : 'flac'};base64,` +
          readFileSync(new URL(`../../probes/audio/pulse.${ext}`, import.meta.url)).toString(
            'base64',
          );
        const browser = await shared.newContext();
        try {
          const page = await browser.newPage();
          await page.setContent('<anima-icon paused></anima-icon>');
          await page.addScriptTag({
            type: 'module',
            content: await bundle(resolve('packages/web/src/media.ts')),
          });
          const result = await page.evaluate(async (source) => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            const done = new Promise<void>((res) =>
              icon.addEventListener('anima:load', () => res(), { once: true }),
            );
            icon.load({
              anima: '0.1',
              name: 'audio',
              grid: 8,
              requires: ['assets'],
              assets: { tone: { type: 'audio', source } },
              nodes: [{ id: 'probe', type: 'circle', center: [4, 4], r: 1 }],
            });
            await done;
            const bytes = (await icon.asset('tone')) as ArrayBuffer;
            const decoded = await new OfflineAudioContext(1, 1, 8000).decodeAudioData(
              bytes.slice(0),
            );
            return {
              length: decoded.length,
              rate: decoded.sampleRate,
              duration: decoded.duration,
              cached: bytes.byteLength,
              samples: Array.from(decoded.getChannelData(0)),
            };
          }, source);
          // FLAC = the 800 authored samples, lossless. MP3 = four MPEG-2.5 frames
          // at 576 samples/frame, without a gapless tag; no waveform identity claim.
          expect(result.length).toBe(ext === 'flac' ? 800 : 2304);
          expect(result.rate).toBe(8000);
          expect(result.duration).toBe(ext === 'flac' ? 0.1 : 0.288);
          expect(result.cached).toBe(ext === 'flac' ? 244 : 1152);
          if (ext === 'flac')
            expect(result.samples).toEqual(
              Array.from({ length: 800 }, (_, i) =>
                i % 16 < 8 ? (name === 'Chromium' ? Math.fround(8192 / 32767) : 0.25) : -0.25,
              ),
            );
          else expect(Math.max(...result.samples.map(Math.abs))).toBeGreaterThan(0.2);
        } finally {
          await browser.close();
        }
      },
    );
    it.each([8, 8.1])(
      'Canvas bilinear clamp matches an independent shader at every pixel for box %s',
      async (boxSize) => {
        const browser = await shared.newContext({ deviceScaleFactor: 1 });
        try {
          const page = await browser.newPage();
          await page.setContent(
            '<style>body{margin:0}anima-icon{display:block;width:64px;height:64px}</style><anima-icon paused renderer="canvas"></anima-icon>',
          );
          for (const entry of ['index', 'paint', 'assets', 'canvas'])
            await page.addScriptTag({
              type: 'module',
              content: await bundle(resolve('packages/web/src/' + entry + '.ts')),
            });
          await page.evaluate(
            async ({ uri, boxSize }) => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              icon.setAttribute('renderer', 'canvas');
              const done = new Promise<void>((res, rej) => {
                icon.addEventListener('anima:load', () => res(), { once: true });
                icon.addEventListener('anima:error', (e) => rej((e as CustomEvent).detail), {
                  once: true,
                });
              });
              icon.load({
                anima: '0.1',
                name: 'clamp',
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
                    width: boxSize,
                    height: boxSize,
                    fit: 'none',
                    align: 'center',
                    sampling: 'bilinear',
                    wrap: 'clamp',
                  },
                ],
              });
              await done;
            },
            { uri, boxSize },
          );
          const shot = PNG.sync.read(await page.locator('anima-icon').screenshot());
          let maxDelta = 0;
          for (let y = 0; y < 64; y++)
            for (let x = 0; x < 64; x++) {
              const u = Math.max(0, Math.min(1, (x + 0.5) / 8 - ((boxSize - 2) / 2 + 0.5))),
                v = Math.max(0, Math.min(1, (y + 0.5) / 8 - ((boxSize - 2) / 2 + 0.5)));
              const expected = [255 * ((1 - u) * (1 - v) + u * v), 255 * u, 255 * (1 - u) * v];
              for (let c = 0; c < 3; c++)
                maxDelta = Math.max(
                  maxDelta,
                  Math.abs(shot.data[(y * 64 + x) * 4 + c]! - Math.round(expected[c]!)),
                );
            }
          // The maximum covers every channel of every pixel; identical bound to
          // individual assertions, without 12,288 assertion-stack constructions.
          expect(maxDelta).toBeLessThanOrEqual(2);
        } finally {
          await browser.close();
        }
      },
    );
    it.each([
      ['assets', 'media'],
      ['media', 'assets'],
    ])('shares resolved pixel resources when %s and then %s register', async (first, second) => {
      const browser = await shared.newContext({ deviceScaleFactor: 1 });
      try {
        const page = await browser.newPage();
        await page.setContent(
          '<style>body{margin:0}anima-icon{display:block;width:80px;height:80px}</style><anima-icon paused></anima-icon>',
        );
        for (const entry of ['index', 'paint-sampling', first, second])
          await page.addScriptTag({
            type: 'module',
            content: await bundle(resolve('packages/web/src/' + entry + '.ts')),
          });
        await page.evaluate(async (uri) => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const done = new Promise<void>((res, rej) => {
            icon.addEventListener('anima:load', () => res(), { once: true });
            icon.addEventListener('anima:error', (e) => rej((e as CustomEvent).detail), {
              once: true,
            });
          });
          icon.load({
            anima: '0.1',
            name: 'resources',
            grid: 8,
            requires: ['assets', 'paint'],
            assets: { tile: { type: 'image', source: uri, width: 1, height: 1 } },
            nodes: [
              {
                id: 'tile',
                type: 'image',
                asset: 'tile',
                x0: 0,
                y0: 0,
                width: 8,
                height: 8,
                fit: 'none',
                align: 'top-left',
                sampling: 'nearest',
                wrap: 'clamp',
              },
            ],
          });
          await done;
        }, uri);
        const shot = PNG.sync.read(await page.locator('anima-icon').screenshot());
        expect(Array.from(shot.data.slice((15 * 80 + 15) * 4, (15 * 80 + 15) * 4 + 4))).toEqual([
          255, 255, 0, 255,
        ]);
      } finally {
        await browser.close();
      }
    });
    it.each(['svg', 'canvas'])(
      'matches independently enumerated repeat/mirror/clamp texels in %s, including axis overrides and resize',
      async (renderer) => {
        const browser = await shared.newContext({ deviceScaleFactor: 1 });
        try {
          const page = await browser.newPage();
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
            'layout',
            ...(renderer === 'canvas' ? ['bilinear'] : []),
          ]) {
            const doc = {
              anima: '0.1',
              name: 'sample',
              grid: 8,
              requires: ['assets', 'paint'],
              assets: {
                tile: {
                  type: 'image',
                  source: uri,
                  width: mode === 'layout' ? 1 : 2,
                  height: mode === 'layout' ? 1 : 2,
                },
              },
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
                      : mode === 'resize' || mode === 'layout'
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
                    mode === 'layout'
                      ? 1
                      : mode === 'resize'
                        ? Math.floor(x / 4)
                        : mode === 'clamp'
                          ? Math.min(x, 1)
                          : mx
                            ? [0, 1, 1, 0][x % 4]!
                            : x % 2,
                  ty =
                    mode === 'layout'
                      ? 1
                      : mode === 'resize'
                        ? Math.floor(y / 4)
                        : mode === 'clamp' || mode === 'axes'
                          ? Math.min(y, 1)
                          : my
                            ? [0, 1, 1, 0][y % 4]!
                            : y % 2;
                const expected =
                  mode === 'bilinear'
                    ? [128, 128, 64]
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
