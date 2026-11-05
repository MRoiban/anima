import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser } from 'playwright-core';
import { PNG } from 'pngjs';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';

const rect = (id: string, color: string, extra: object = {}) => ({
  id,
  type: 'rect',
  x0: 0,
  y0: 0,
  w: 20,
  h: 20,
  fill: { color },
  ...extra,
});
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
  describe(name + ' composite paint', () => {
    let browser: Browser, js: string, paint: string, composite: string, markup: string;
    beforeAll(async () => {
      const path = paths.find((p) => p && existsSync(p));
      if (!path) throw Error('browser absent');
      browser = await engine.launch({ executablePath: path, headless: true });
      [js, paint, composite, markup] = await Promise.all([
        bundle(resolve('packages/web/src/index.ts')),
        bundle(resolve('packages/web/src/paint.ts')),
        bundle(resolve('packages/web/src/composite.ts')),
        bundle(resolve('packages/web/src/markup.ts')),
      ]);
    }, 30000);
    afterAll(async () => {
      await browser?.close();
    });
    const cases: [string, object[], number[], number[]][] = [
      [
        'blend',
        [rect('a', '#f00'), rect('b', '#00f', { blend: 'screen' })],
        [100, 100],
        [255, 0, 255],
      ],
      ...(['alpha', 'luminance', 'inverted-alpha', 'inverted-luminance'] as const).map(
        (mode) =>
          [
            mode,
            [
              rect('a', '#f00', { mask: { source: 'b', mode, sourceDraws: false } }),
              rect('b', '#fff', { w: 10 }),
            ],
            [mode.startsWith('inverted') ? 150 : 50, 100],
            [255, 0, 0],
          ] as [string, object[], number[], number[]],
      ),
      ...(['alpha', 'luminance', 'inverted-alpha', 'inverted-luminance'] as const).map(
        (mode) =>
          [
            mode + ' colour',
            [
              rect('a', '#f00', { mask: { source: 'b', mode, sourceDraws: false } }),
              rect('b', '#ff0000'),
            ],
            [100, 100],
            mode === 'alpha'
              ? [255, 0, 0]
              : mode === 'luminance'
                ? [255, 201, 201]
                : mode === 'inverted-alpha'
                  ? [255, 255, 255]
                  : [255, 54, 54],
          ] as [string, object[], number[], number[]],
      ),
      [
        'clip',
        [
          rect('a', '#f00', { clip: { source: 'b', rule: 'nonzero' } }),
          rect('b', '#fff', { w: 10, visible: false }),
        ],
        [50, 100],
        [255, 0, 0],
      ],
      ...([false, true] as const).flatMap((outside) => [
        [
          `group clip ${outside ? 'outside' : 'inside'}`,
          [
            {
              id: 'g',
              type: 'group',
              x: 2,
              clip: { source: 'b' },
              children: [rect('a', '#f00'), rect('c', '#00f', { x0: 5, w: 15 })],
            },
            rect('b', '#000', { w: 10, visible: false }),
          ],
          [outside ? 150 : 80, 100],
          outside ? [255, 255, 255] : [0, 0, 255],
        ] as [string, object[], number[], number[]],
      ]),
      [
        'paints',
        [
          {
            id: 'a',
            type: 'rect',
            x0: 0,
            y0: 0,
            w: 20,
            h: 20,
            paints: [{ fill: { color: '#f00' } }, { fill: { color: '#00f', visible: false } }],
          },
        ],
        [100, 100],
        [255, 0, 0],
      ],
      [
        'gradient paints',
        [
          {
            id: 'a',
            type: 'rect',
            x0: 0,
            y0: 0,
            w: 20,
            h: 20,
            paints: [
              {
                fill: {
                  type: 'linear',
                  x1: 0,
                  y1: 0,
                  x2: 20,
                  y2: 0,
                  stops: [
                    { position: 0, color: '#f00' },
                    { position: 1, color: '#f00' },
                  ],
                },
              },
            ],
          },
        ],
        [100, 100],
        [255, 0, 0],
      ],
      [
        'clip evenodd',
        [
          rect('a', '#f00', { clip: { source: 'b', rule: 'evenodd' } }),
          {
            id: 'b',
            type: 'path',
            d: 'M0 0H20V20H0ZM5 5H15V15H5Z',
            visible: false,
            fill: { color: '#fff' },
          },
        ],
        [100, 100],
        [255, 255, 255],
      ],
      [
        'before',
        [rect('a', '#f00'), rect('b', '#00f', { drawOrder: { target: 'a', position: 'before' } })],
        [100, 100],
        [255, 0, 0],
      ],
      [
        'center',
        [
          rect('a', '#fff', {
            x0: 5,
            y0: 5,
            w: 10,
            h: 10,
            stroke: { color: '#f00', width: 2, position: 'center' },
          }),
        ],
        [45, 100],
        [255, 0, 0],
      ],
      [
        'inside',
        [
          rect('a', '#fff', {
            x0: 5,
            y0: 5,
            w: 10,
            h: 10,
            stroke: { color: '#f00', width: 2, position: 'inside' },
          }),
        ],
        [55, 100],
        [255, 0, 0],
      ],
      [
        'outside',
        [
          rect('a', '#fff', {
            x0: 5,
            y0: 5,
            w: 10,
            h: 10,
            stroke: { color: '#f00', width: 2, position: 'outside' },
          }),
        ],
        [45, 100],
        [255, 0, 0],
      ],
      [
        'order',
        [rect('a', '#f00', { drawOrder: { target: 'b', position: 'after' } }), rect('b', '#00f')],
        [100, 100],
        [255, 0, 0],
      ],
    ];
    it.each(cases)(
      '%s pixels',
      async (_name, nodes, point, expected) => {
        const page = await browser.newPage();
        try {
          await page.setContent(
            '<style>body{margin:0;background:white}anima-icon{display:block;width:200px;height:200px}</style>',
          );
          for (const content of [js, paint, composite])
            await page.addScriptTag({ type: 'module', content });
          await page.waitForFunction(() =>
            (customElements.get('anima-icon') as typeof AnimaIcon)?.modules.has('composite'),
          );
          const diagnostics = await page.evaluate(async (nodes) => {
            const icon = document.createElement('anima-icon') as AnimaIcon;
            icon.setAttribute('paused', '');
            document.body.append(icon);
            const result = await icon.load({
              anima: '0.1',
              name: 'composite',
              grid: 20,
              requires: ['paint', 'composite'],
              nodes,
            });
            await icon.ready;
            return result;
          }, nodes);
          expect(diagnostics).toEqual([]);
          const png = PNG.sync.read(await page.locator('anima-icon').screenshot());
          const offset = (point[1]! * png.width + point[0]!) * 4;
          expect([...png.data.subarray(offset, offset + 3)]).toEqual(expected);
        } finally {
          await page.close();
        }
      },
      15000,
    );

    it('all blend modes match native CSS pixels', async () => {
      const page = await browser.newPage();
      try {
        await page.setContent(
          '<style>body{margin:0;background:white}anima-icon{display:block;width:200px;height:200px}</style><div id="reference" style="width:200px;height:200px;isolation:isolate;background:#4080c0"><div style="width:100%;height:100%;background:#c08040"></div></div>',
        );
        for (const content of [js, paint, composite])
          await page.addScriptTag({ type: 'module', content });
        await page.waitForFunction(() =>
          (customElements.get('anima-icon') as typeof AnimaIcon)?.modules.has('composite'),
        );
        for (const blend of 'normal multiply screen overlay darken lighten color-dodge color-burn hard-light soft-light difference exclusion hue saturation color luminosity'.split(
          ' ',
        )) {
          await page.evaluate(async (blend) => {
            document.querySelector('anima-icon')?.remove();
            (document.querySelector('#reference div') as HTMLElement).style.mixBlendMode = blend;
            const icon = document.createElement('anima-icon') as AnimaIcon;
            icon.setAttribute('paused', '');
            document.body.append(icon);
            await icon.load({
              anima: '0.1',
              name: 'blends',
              grid: 20,
              requires: ['paint', 'composite'],
              nodes: [
                { id: 'a', type: 'rect', x0: 0, y0: 0, w: 20, h: 20, fill: { color: '#4080c0' } },
                {
                  id: 'b',
                  type: 'rect',
                  x0: 0,
                  y0: 0,
                  w: 20,
                  h: 20,
                  fill: { color: '#c08040' },
                  blend,
                },
              ],
            });
            await icon.ready;
          }, blend);
          const actual = PNG.sync.read(await page.locator('anima-icon').screenshot());
          const expected = PNG.sync.read(await page.locator('#reference').screenshot());
          const at = (100 * 200 + 100) * 4;
          expect([...actual.data.subarray(at, at + 4)], blend).toEqual([
            ...expected.data.subarray(at, at + 4),
          ]);
        }
      } finally {
        await page.close();
      }
    }, 30000);
    it.each(['mask', 'clip', 'order'])(
      'retains DOM and animates %s dependencies',
      async (kind) => {
        const page = await browser.newPage();
        try {
          await page.setContent(
            '<style>body{margin:0;background:white}anima-icon{display:block;width:200px;height:200px}</style>',
          );
          for (const content of [js, paint, composite])
            await page.addScriptTag({ type: 'module', content });
          await page.waitForFunction(() =>
            (customElements.get('anima-icon') as typeof AnimaIcon)?.modules.has('composite'),
          );
          const nodes =
            kind === 'order'
              ? [
                  rect('a', '#f00', { drawOrder: { target: 'b', position: 'after' } }),
                  rect('b', '#00f'),
                ]
              : [
                  rect(
                    'a',
                    '#f00',
                    kind === 'mask'
                      ? { mask: { source: 'b', mode: 'alpha', sourceDraws: false } }
                      : { clip: { source: 'b', rule: 'nonzero' } },
                  ),
                  rect('b', kind === 'mask' ? '#fff' : '#00000000', { w: 10 }),
                ];
          await page.evaluate(
            async ({ nodes, kind }) => {
              const icon = document.createElement('anima-icon') as AnimaIcon;
              icon.setAttribute('paused', '');
              document.body.append(icon);
              const address = kind === 'order' ? 'a.drawOrder.active' : 'b.x';
              await icon.load({
                anima: '0.1',
                name: 'animated',
                grid: 20,
                requires: ['paint', 'composite'],
                nodes,
                timelines: {
                  t: {
                    duration: 1,
                    tracks: {
                      [address]:
                        kind === 'order'
                          ? [
                              [0, true],
                              [1, false],
                            ]
                          : [
                              [0, 0],
                              [1, 10],
                            ],
                    },
                  },
                },
                machine: { layers: { l: { initial: 's', states: { s: { play: 't' } } } } },
              });
              await icon.ready;
              (window as unknown as { retained: Element[] }).retained = [
                ...icon.shadowRoot!.querySelectorAll('svg *'),
              ];
            },
            { nodes, kind },
          );
          const before = PNG.sync.read(await page.locator('anima-icon').screenshot());
          const at = (100 * 200 + 50) * 4;
          expect([...before.data.subarray(at, at + 3)]).toEqual([255, 0, 0]);
          await page.evaluate(() => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            icon.player!.step(1);
            icon.invalidate();
          });
          const after = PNG.sync.read(await page.locator('anima-icon').screenshot());
          expect([...after.data.subarray(at, at + 3)]).toEqual(
            kind === 'order' ? [0, 0, 255] : [255, 255, 255],
          );
          expect(
            await page.evaluate(() => {
              const before = (window as unknown as { retained: Element[] }).retained;
              const now = [
                ...document.querySelector('anima-icon')!.shadowRoot!.querySelectorAll('svg *'),
              ];
              return before.length === now.length && before.every((el) => now.includes(el));
            }),
          ).toBe(true);
        } finally {
          await page.close();
        }
      },
      15000,
    );
    it.each(['paint-first', 'composite-first'])(
      'shares registries, draw data and SVG helpers across separate bundles (%s)',
      async (order) => {
        const page = await browser.newPage();
        try {
          await page.setContent('');
          for (const code of [
            js,
            ...(order === 'paint-first' ? [paint, composite] : [composite, paint]),
            markup,
          ])
            await page.addScriptTag({ type: 'module', content: code });
          await page.waitForFunction(() => {
            const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
            return Icon?.modules.has('paint') && Icon.modules.has('composite') && !!Icon.compiler;
          });
          const result = await page.evaluate(async () => {
            const icon = document.createElement('anima-icon') as AnimaIcon;
            icon.setAttribute('paused', '');
            document.body.append(icon);
            const diagnostics = icon.load(
              `<anima version="0.1" name="both" grid="20" requires="paint composite">
            <ellipse id="source" cx="10" cy="10" rx="6" ry="8" fill="#fff"/>
            <rect id="tile" x0="0" y0="0" width="20" height="20">
              <clip source="source" rule="evenodd"/>
              <fillPaint type="linear" x1="0" y1="0" x2="20" y2="0"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></fillPaint>
            </rect>
            <timeline name="t" duration="1"><track target="tile.paints.0.fill.x2">0 20; 1 10</track></timeline>
            <layer name="l" initial="s"><state name="s" play="t"/></layer>
          </anima>`,
              true,
            );
            if (diagnostics.length) return { diagnostics };
            await icon.ready;
            const gradient = icon.shadowRoot!.querySelector('linearGradient')!,
              shape = icon.shadowRoot!.querySelector('rect[fill^="url"]')!,
              clip = icon.shadowRoot!.querySelector('clipPath path')!;
            const before = gradient.getAttribute('x2');
            icon.player!.step(1);
            icon.invalidate();
            return {
              diagnostics,
              before,
              after: gradient.getAttribute('x2'),
              linked: shape.getAttribute('fill') === `url(#${gradient.id})`,
              retained: gradient === icon.shadowRoot!.querySelector('linearGradient'),
              clip: !!clip.getAttribute('d'),
            };
          });
          expect(result).toEqual({
            diagnostics: [],
            before: '20',
            after: '10',
            linked: true,
            retained: true,
            clip: true,
          });
        } finally {
          await page.close();
        }
      },
      15000,
    );
  });
