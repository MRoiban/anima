import { existsSync, globSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { chromium, firefox, type Browser, type Page } from 'playwright-core';
import { PNG } from 'pngjs';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { bundle } from '../../../../tools/browser-build.ts';
import '@anima-format/core/all';
import { load, drawFrame, runScript, Player, toSVG } from '@anima-format/core';
import type {} from './harness.ts';

// Fixed feature tolerances, declared before measurements; see README. Never widen on failure.
const limit = (doc: object) => {
  const s = JSON.stringify(doc);
  return /feather/.test(s)
    ? { max: 128, percent: 0.5, feature: 'feather' }
    : /"(?:d|glyph|r|rx|ry|radius|center|corners|trimStart|dash)"/.test(s)
      ? { max: 128, percent: 0.5, feature: 'curved/dashed geometry' }
      : { max: 2, percent: 0, feature: 'flat/gradient interiors' };
};
const cases: { name: string; doc: object; script: string; svgUnsupported: boolean }[] = [];
for (const file of globSync([
  'spec/conformance/*/case.ani',
  'spec/draw-conformance/*/case.ani',
  'examples/*.ani',
])) {
  if (existsSync(resolve(dirname(file), 'todo.json'))) continue;
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  const model = load(doc).model;
  if (!model) throw Error('invalid visual corpus ' + file);
  const scriptFile = resolve(dirname(file), 'script.txt');
  const script = existsSync(scriptFile) ? readFileSync(scriptFile, 'utf8') : '';
  const boundaries = [...script.matchAll(/^snapshot[^\n]*/gm)].map((m) => script.slice(0, m.index));
  const scripts = boundaries.length ? boundaries : [''];
  if (file.startsWith('examples/')) {
    for (const timeline of model.timelines) scripts.push(`advance ${timeline.duration / 2}`);
  }
  for (const [index, script] of scripts.entries()) {
    const f = drawFrame(runScript(model, script).player);
    if (!f.nodes.some((n) => n.geometry && (n.paints.some((p) => p.visible) || n.geometry.image)))
      continue;
    cases.push({
      name: `${file}#${index}`,
      doc,
      script,
      svgUnsupported: existsSync(resolve(dirname(file), 'unsupported-svg.json')),
    });
  }
}
// Live-source regressions use the same fixed feature classifier and pixel limits as the corpus.
for (const variant of [
  'gradient',
  'nested',
  'opacity',
  'clip',
  'paint-in-paint',
  'two-owners',
  'source-order',
  'hidden',
]) {
  const doc = {
    anima: '0.1',
    name: 'component-source-' + variant,
    grid: 20,
    requires: ['components', 'paint', 'componentpaint', 'nested', 'composite'],
    components: {
      row: {
        grid: 10,
        nodes: [
          { id: 'tile', type: 'rect', x0: 0, y0: 0, w: 10, h: 10, fill: { color: '#204080' } },
        ],
      },
      leaf: {
        grid: 10,
        nodes: [
          { id: 'leaf', type: 'rect', x0: 0, y0: 0, w: 10, h: 10, fill: { color: '#e08020' } },
        ],
      },
    },
    nodes: [
      { id: 'target', type: 'rect', x0: 0, y0: 0, w: 20, h: 20, fill: { paint: 'component:row' } },
    ],
  } as import('../../../../packages/core/src/load.ts').Model['doc'];
  const row = doc.components.row.nodes[0];
  if (variant === 'gradient')
    row.fill = {
      type: 'linear',
      x1: 0,
      y1: 0,
      x2: 10,
      y2: 0,
      stops: [
        { position: 0, color: '#204080' },
        { position: 1, color: '#e08020' },
      ],
    };
  if (variant === 'nested')
    doc.components.row.nodes = [{ id: 'child', type: 'instance', component: 'leaf' }];
  if (variant === 'opacity') row.opacity = 0.5;
  if (variant === 'clip') {
    row.clip = { source: 'clip' };
    doc.components.row.nodes.push({ id: 'clip', type: 'rect', x0: 2, y0: 2, w: 6, h: 6 });
  }
  if (variant === 'paint-in-paint') row.fill = { paint: 'component:leaf' };
  if (variant === 'hidden') doc.nodes[0].fill.visible = false;
  if (variant === 'source-order') {
    row.drawOrder = { target: 'front', position: 'after' };
    doc.components.row.nodes.push({
      id: 'front',
      type: 'rect',
      x0: 0,
      y0: 0,
      w: 10,
      h: 10,
      fill: { color: '#e08020' },
    });
  }
  if (variant === 'two-owners') {
    doc.nodes[0].w = 10;
    doc.nodes.push({ ...doc.nodes[0], id: 'second', x: 10 });
  }
  cases.push({
    name: 'component-paint/' + variant,
    doc,
    script: 'advance 0.5',
    svgUnsupported: false,
  });
}
// Regression corpus: per-paint blending must see the same backdrop through transforms,
// while authored opacity/masks continue to isolate it. Same fixed comparison classifier.
const blendDoc = JSON.parse(
  readFileSync('spec/conformance/drawing-paint-paint-blend-override/case.ani', 'utf8'),
);
for (const variant of [
  'parent',
  'reflect',
  'opacity',
  'mask',
  'clip',
  'position',
  'gradient',
  'ordered',
  'contour',
  'animate',
]) {
  const doc = structuredClone(blendDoc);
  doc.requires.push('paint', 'contour');
  const front = doc.nodes[1];
  front.x = 1;
  front.stroke.join = 'miter';
  if (variant === 'reflect') {
    front.x = 20;
    front.scaleX = -1;
  }
  if (variant === 'opacity') front.opacity = 0.5;
  if (variant === 'position') front.stroke.position = 'outside';
  if (variant === 'mask' || variant === 'clip') {
    doc.nodes.push({
      id: 'source',
      type: 'circle',
      center: [10, 10],
      r: 6,
      x: 1,
      fill: { color: variant === 'clip' ? '#00000000' : '#00000080' },
    });
    front[variant] = {
      source: 'source',
      ...(variant === 'mask' ? { mode: 'alpha', sourceDraws: false } : {}),
    };
  }
  if (variant === 'gradient')
    Object.assign(front.fill, {
      type: 'linear',
      x1: 0,
      y1: 0,
      x2: 20,
      y2: 0,
      stops: [
        { position: 0, color: '#804020' },
        { position: 1, color: '#204080' },
      ],
    });
  if (variant === 'gradient') delete front.fill.color;
  if (variant === 'ordered') {
    front.paints = [{ fill: front.fill }, { stroke: front.stroke }];
    delete front.fill;
    delete front.stroke;
  }
  if (variant === 'contour') {
    front.type = 'contour';
    front.vertices = [
      { point: [4, 4], kind: 'straight' },
      { point: [16, 4], kind: 'straight' },
      { point: [16, 16], kind: 'straight' },
      { point: [4, 16], kind: 'straight' },
    ];
    front.closed = true;
    for (const k of ['x0', 'y0', 'w', 'h']) Reflect.deleteProperty(front, k);
  }
  if (variant === 'parent' || variant === 'animate') {
    doc.nodes[1] = { id: 'group', type: 'group', x: 1, y: 1, children: [front] };
    if (variant === 'animate') {
      doc.timelines = {
        move: {
          duration: 1,
          tracks: {
            'group.x': [
              [0, 1],
              [1, 2],
            ],
          },
        },
      };
      doc.machine = { layers: { move: { initial: 's', states: { s: { play: 'move' } } } } };
    }
  }
  cases.push({
    name: 'mix-regression-' + variant,
    doc,
    script: variant === 'animate' ? 'advance 1' : '',
    svgUnsupported: false,
  });
}
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
  describe(name + ' canvas', () => {
    let browser: Browser, page: Page;
    const metrics: object[] = [];
    beforeAll(async () => {
      const executablePath = paths.find((p) => p && existsSync(p));
      if (!executablePath) throw Error('browser absent');
      browser = await engine.launch({ executablePath, headless: true });
      page = await browser.newPage({ viewport: { width: 600, height: 600 } });
      await page.route('https://canvas.test/', (r) =>
        r.fulfill({
          contentType: 'text/html',
          body: '<style>body{margin:0;background:white}anima-icon{isolation:isolate}</style>',
        }),
      );
      await page.goto('https://canvas.test/');
      await page.addScriptTag({
        type: 'module',
        content: await bundle(resolve('modules/canvas/test/web/harness.ts')),
      });
      await page.waitForFunction(() => !!window.canvasTest);
    }, 60000);
    afterAll(async () => {
      const out = resolve('modules/canvas/test/web/artifacts');
      mkdirSync(out, { recursive: true });
      writeFileSync(
        resolve(
          out,
          name + (metrics.some((m) => 'name' in m) ? '-metrics.json' : '-host-metrics.json'),
        ),
        JSON.stringify(metrics, null, 2) + '\n',
      );
      await browser?.close();
    });
    for (const c of cases)
      it(
        c.name,
        async () => {
          if (c.svgUnsupported) {
            const p = new Player(load(c.doc).model!);
            expect(() => toSVG(p)).toThrowError(
              expect.objectContaining({
                code: 'unsupported-render',
                message: expect.stringContaining(
                  JSON.stringify(c.doc).includes('angular')
                    ? 'angular'
                    : JSON.stringify(c.doc).includes('screen')
                      ? 'per-paint'
                      : 'additive',
                ),
                hint: expect.stringContaining('canvas'),
              }),
            );
            await page.evaluate(
              ({ doc, script }) => window.canvasTest.mount(doc, 'canvas', script),
              c,
            );
            expect(await page.evaluate(() => window.canvasTest.errors)).toEqual([]);
            const colors = await page.evaluate(() => {
              const renderer = window.canvasTest.renderer;
              const ctx = renderer.canvas.getContext('2d')!;
              const at = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
              return [at(180, 120), at(120, 180), at(60, 120), at(120, 60)];
            });
            expect(colors.every((p) => p[3] === 255)).toBe(true);
            if (JSON.stringify(c.doc).includes('angular')) {
              const locations = [
                [180, 120],
                [120, 180],
                [60, 120],
                [120, 60],
              ];
              const expected = locations.map(([x, y]) => {
                const t = Math.atan2(y! + 0.5, x! + 0.5) / (2 * Math.PI);
                return [66 + 151 * t, 99 + 20 * t, 235 - 148 * t];
              });
              colors.forEach((p, i) =>
                p
                  .slice(0, 3)
                  .forEach((v, k) =>
                    expect(Math.abs(v - Math.round(expected[i]![k]!))).toBeLessThanOrEqual(1),
                  ),
              );
            } else {
              const center = await page.evaluate(() => [
                ...window.canvasTest.renderer.canvas.getContext('2d')!.getImageData(120, 120, 1, 1)
                  .data,
              ]);
              const strength = JSON.stringify(c.doc).includes('timelines')
                ? [...c.script.matchAll(/^advance ([\d.]+)/gm)].reduce(
                    (sum, m) => sum + Number(m[1]),
                    0,
                  )
                : JSON.stringify(c.doc).includes('strength')
                  ? 0.5
                  : 1;
              expect(center).toEqual(
                JSON.stringify(c.doc).includes('screen')
                  ? [144, 112, 116, 255]
                  : [
                      Math.round(128 + 32 * strength),
                      Math.round(64 + 64 * strength),
                      Math.round(32 + 96 * strength),
                      255,
                    ],
              );
            }
            metrics.push({
              name: c.name,
              status: 'unsupported-svg',
              reason: 'SVG explicitly refuses this feature',
              canvasColors: colors,
            });
            return;
          }
          const images: PNG[] = [];
          const diagnostics: unknown[] = [];
          for (const backend of ['svg', 'canvas']) {
            await page.evaluate(
              async ({ doc, backend, script }) => window.canvasTest.mount(doc, backend, script),
              { ...c, backend },
            );
            diagnostics.push(...(await page.evaluate(() => window.canvasTest.errors)));
            images.push(
              PNG.sync.read(
                await page
                  .locator('anima-icon')
                  .locator(backend === 'svg' ? 'svg' : 'canvas')
                  .first()
                  .screenshot(),
              ),
            );
          }
          const [a, b] = images as [PNG, PNG];
          expect([a.width, a.height]).toEqual([b.width, b.height]);
          let max = 0,
            over = 0;
          const diff = new PNG({ width: a.width, height: a.height });
          for (let i = 0; i < a.data.length; i += 4) {
            let d = 0;
            for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(a.data[i + k]! - b.data[i + k]!));
            max = Math.max(max, d);
            if (d > 16) over++;
            diff.data[i] = diff.data[i + 1] = diff.data[i + 2] = d;
            diff.data[i + 3] = 255;
          }
          const percent = (over / (a.width * a.height)) * 100,
            tolerance = limit(c.doc);
          const result = { name: c.name, max, over, percent, tolerance, diagnostics };
          metrics.push(result);
          if (max > tolerance.max || percent > tolerance.percent || diagnostics.length) {
            const prefix = resolve(
              'modules/canvas/test/web/artifacts',
              name + '-' + c.name.replaceAll(/[^\w-]/g, '_'),
            );
            mkdirSync(dirname(prefix), { recursive: true });
            for (const [suffix, img] of [
              ['svg', a],
              ['canvas', b],
              ['diff', diff],
            ] as const)
              writeFileSync(prefix + '-' + suffix + '.png', PNG.sync.write(img));
          }
          expect(diagnostics, JSON.stringify(result)).toEqual([]);
          expect(max, JSON.stringify(result)).toBeLessThanOrEqual(tolerance.max);
          expect(percent, JSON.stringify(result)).toBeLessThanOrEqual(tolerance.percent);
        },
        15000,
      );
    it('lets a host renderer factory own and release its paths and gradient resources', async () => {
      const events = await page.evaluate(() => window.canvasTest.customFactory());
      expect(events.filter((e) => e === 'factory')).toHaveLength(1);
      expect(events).toEqual(
        expect.arrayContaining(['resources', 'draw', 'force', 'destroy', 'disconnect', 'connect']),
      );
      expect(events.filter((e) => e === 'destroy')).toHaveLength(1);
    });
    it('keeps nearest image texels and half-pixel fitted-edge coverage', async () => {
      await page.evaluate(
        (doc) => window.canvasTest.mount(doc, 'canvas', 'advance 0.5'),
        JSON.parse(readFileSync('spec/conformance/assets-image/case.ani', 'utf8')),
      );
      const pixels = await page.evaluate(() => {
        const ctx = window.canvasTest.renderer.canvas.getContext('2d')!;
        return [81, 82, 83, 156, 157, 158].map((y) => [...ctx.getImageData(50, y, 1, 1).data]);
      });
      // Assert geometric coverage directly; unpremultiplying half-alpha green
      // reads 39 in Firefox and 40 in Chromium. Interiors retain the exact texel.
      expect(pixels.map((p) => p[3])).toEqual([0, 128, 255, 255, 128, 0]);
      expect(pixels.slice(2, 4)).toEqual([
        [255, 40, 0, 255],
        [255, 40, 0, 255],
      ]);
    });
    it('clamps border texels at fractional image edges instead of repeating or dropping them', async () => {
      const source = new PNG({ width: 2, height: 1 });
      source.data.set([255, 0, 0, 255, 0, 0, 255, 255]);
      const doc = {
        anima: '0.1',
        name: 'fractional-image',
        grid: 24,
        requires: ['paint', 'assets'],
        nodes: [
          {
            id: 'image',
            type: 'image',
            asset: 'image',
            x0: 0.075,
            y0: 0.1,
            width: 2,
            height: 0.8,
            fit: 'fill',
            sampling: 'nearest',
          },
        ],
        assets: {
          image: {
            type: 'image',
            storage: 'embedded',
            width: 2,
            height: 1,
            source: 'data:image/png;base64,' + PNG.sync.write(source).toString('base64'),
          },
        },
      };
      await page.evaluate((doc) => window.canvasTest.mount(doc, 'canvas'), doc);
      const pixels = await page.evaluate(() => {
        const ctx = window.canvasTest.renderer.canvas.getContext('2d')!;
        return [0, 1, 19, 20].map((x) => [...ctx.getImageData(x, 4, 1, 1).data]);
      });
      expect(pixels).toEqual([
        [255, 0, 0, 64],
        [255, 0, 0, 255],
        [0, 0, 255, 255],
        [0, 0, 255, 191],
      ]);
    });
    it('uses DPR, resizes without stepping, and skips unchanged revisions', async () => {
      await page.evaluate(
        (doc) => window.canvasTest.mount(doc, 'canvas'),
        JSON.parse(readFileSync('examples/bell.ani', 'utf8')),
      );
      expect(await page.evaluate(() => window.canvasTest.unchanged())).toBe(0);
      const time = await page.evaluate(() => window.canvasTest.icon.player!.time);
      for (const ratio of [1, 1.5, 2, 3]) {
        await page.evaluate(
          (ratio) => window.canvasTest.icon.setAttribute('pixel-ratio', String(ratio)),
          ratio,
        );
        await page.waitForFunction(
          (ratio) => window.canvasTest.renderer.canvas.width === Math.round(240 * ratio),
          ratio,
        );
      }
      await page.evaluate(() => (window.canvasTest.icon.style.width = '300px'));
      await page.waitForFunction(() => window.canvasTest.renderer.canvas.width === 1080);
      expect(await page.evaluate(() => window.canvasTest.icon.player!.time)).toBe(time);
      await page.evaluate(() => window.canvasTest.icon.setAttribute('pixel-ratio', 'bad'));
      await page.waitForFunction(() =>
        window.canvasTest.errors.some((e) => e.code === 'bad-pixel-ratio'),
      );
      expect(await page.evaluate(() => window.canvasTest.errors.at(-1))).toMatchObject({
        code: 'bad-pixel-ratio',
        pointer: '',
        message: expect.any(String),
        hint: expect.any(String),
      });
    });
    it('keeps pointer routing, reduced motion, sleeping and renderer state', async () => {
      await page.evaluate(
        (doc) => window.canvasTest.mount(doc, 'canvas'),
        JSON.parse(readFileSync('examples/bell.ani', 'utf8')),
      );
      await page.evaluate(() => {
        const icon = window.canvasTest.icon;
        icon.setAttribute('motion', 'reduce');
        icon.trace = [];
        icon.play();
      });
      await page.locator('anima-icon').click();
      await page.waitForFunction(
        () =>
          window.canvasTest.icon.player!.states().ring === 'rested' &&
          window.canvasTest.icon.values()['dot.scale'] === 1 &&
          window.canvasTest.icon.playback === 'settled',
      );
      // Drain pending layout/paint notifications before measuring the idle interval.
      await page.evaluate(
        () =>
          new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
      );
      const snapshot = await page.evaluate(() => {
        const h = window.canvasTest;
        return {
          values: h.icon.values(),
          states: h.icon.player!.states(),
          time: h.icon.player!.time,
          draws: h.renderer.draws,
        };
      });
      await page.waitForTimeout(200); // The idle interval is the assertion.
      expect(await page.evaluate(() => window.canvasTest.renderer.draws)).toBe(snapshot.draws);
      await page.evaluate(() => window.canvasTest.icon.setAttribute('renderer', 'svg'));
      expect(await page.evaluate(() => window.canvasTest.icon.values())).toEqual(snapshot.values);
      expect(await page.locator('anima-icon').locator('canvas').count()).toBe(0);
      await page.evaluate(() => window.canvasTest.icon.setAttribute('renderer', 'canvas'));
      expect(await page.evaluate(() => window.canvasTest.icon.player!.states())).toEqual(
        snapshot.states,
      );
      expect(await page.evaluate(() => window.canvasTest.icon.player!.time)).toBe(snapshot.time);
      await page.evaluate(() => window.canvasTest.icon.setAttribute('renderer', 'absent'));
      expect(await page.evaluate(() => window.canvasTest.errors.at(-1))).toMatchObject({
        code: 'unsupported-render',
        pointer: '',
        message: expect.stringContaining('absent'),
        hint: expect.any(String),
      });
    });
    it('renders world feather through nonuniform node scales and diagnoses local feather', async () => {
      const doc = {
        anima: '0.1',
        name: 'feather-world',
        grid: 20,
        requires: ['surface', 'paint'],
        nodes: [
          {
            id: 'r',
            type: 'rect',
            x0: 4,
            y0: 4,
            w: 6,
            h: 8,
            scaleX: 1.5,
            fill: { color: '#f00', feather: { inner: 1, outer: 2, space: 'world' } },
          },
        ],
      };
      await page.evaluate((doc) => window.canvasTest.mount(doc, 'canvas'), doc);
      expect(await page.evaluate(() => window.canvasTest.errors)).toEqual([]);
      const alpha = await page.evaluate(() => {
        const c = window.canvasTest.renderer.canvas,
          ctx = c.getContext('2d')!;
        return [...ctx.getImageData(60, 100, 1, 1).data];
      });
      expect(alpha[3]).toBeGreaterThan(0);
      expect(alpha[3]).toBeLessThan(255);
      doc.nodes[0]!.fill.feather.space = 'local';
      await page.evaluate((doc) => window.canvasTest.mount(doc, 'canvas'), doc);
      expect(await page.evaluate(() => window.canvasTest.errors)).toContainEqual(
        expect.objectContaining({
          code: 'unsupported-render',
          pointer: expect.stringContaining('/fill'),
          message: expect.stringContaining('nonuniform local feather'),
          hint: expect.any(String),
        }),
      );
    });
    it('reports partial fixed-stroke trims and preserves zero-width strokes', async () => {
      const doc = {
        anima: '0.1',
        name: 'fixed-trim',
        grid: 20,
        requires: ['paint'],
        nodes: [
          {
            id: 'p',
            type: 'path',
            d: 'M2 10L18 10',
            stroke: { color: '#000', width: 2, scale: 'fixed', trimEnd: 0.5 },
          },
        ],
      };
      await page.evaluate((doc) => window.canvasTest.mount(doc, 'canvas'), doc);
      expect(await page.evaluate(() => window.canvasTest.errors)).toContainEqual(
        expect.objectContaining({
          code: 'unsupported-render',
          pointer: '/nodes/0/stroke',
          message: expect.stringContaining('fixed stroke trim'),
          hint: expect.any(String),
        }),
      );
      doc.nodes[0]!.stroke.width = 0;
      await page.evaluate((doc) => window.canvasTest.mount(doc, 'canvas'), doc);
      expect(
        await page.evaluate(() => [
          ...window.canvasTest.renderer.canvas.getContext('2d')!.getImageData(120, 120, 1, 1).data,
        ]),
      ).toEqual([0, 0, 0, 0]);
    });
    it('resolves currentColor and CSS slots on explicit invalidation', async () => {
      const doc = {
        anima: '0.1',
        name: 'colours',
        grid: 20,
        colors: { ink: 'currentColor' },
        nodes: [{ id: 'c', type: 'circle', center: [10, 10], r: 5, fill: { color: 'ink' } }],
      };
      await page.evaluate((doc) => window.canvasTest.mount(doc, 'canvas'), doc);
      const read = () =>
        page.evaluate(() => [
          ...window.canvasTest.renderer.canvas.getContext('2d')!.getImageData(120, 120, 1, 1).data,
        ]);
      await page.evaluate(() => {
        const i = window.canvasTest.icon;
        i.style.color = 'rgb(12,34,56)';
        i.invalidate();
      });
      expect(await read()).toEqual([12, 34, 56, 255]);
      await page.evaluate(() => {
        const i = window.canvasTest.icon;
        i.style.setProperty('--anima-ink', 'rgb(78,90,123)');
        i.invalidate();
      });
      expect(await read()).toEqual([78, 90, 123, 255]);
    });
    it('modulates image paints in sRGB including alpha', async () => {
      const source =
        'data:image/svg+xml,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><path fill="white" d="M0 0h2v2H0z"/></svg>',
        );
      const doc = {
        anima: '0.1',
        name: 'modulate',
        grid: 20,
        requires: ['surface', 'assets', 'paint'],
        assets: { tile: { type: 'image', source } },
        nodes: [
          {
            id: 'r',
            type: 'rect',
            x0: 0,
            y0: 0,
            w: 20,
            h: 20,
            fill: {
              type: 'image',
              asset: 'tile',
              imageWidth: 2,
              imageHeight: 2,
              modulate: '#ff000080',
            },
          },
        ],
      };
      await page.evaluate((doc) => window.canvasTest.mount(doc, 'canvas'), doc);
      expect(
        await page.evaluate(() => [
          ...window.canvasTest.renderer.canvas.getContext('2d')!.getImageData(120, 120, 1, 1).data,
        ]),
      ).toEqual([255, 0, 0, 128]);
    });
    it.each(['svg', 'canvas'])('measures %s step + draw in a real browser', async (backend) => {
      await page.evaluate(({ doc, backend }) => window.canvasTest.mount(doc, backend), {
        doc: JSON.parse(readFileSync('examples/bell.ani', 'utf8')),
        backend,
      });
      const us = await page.evaluate(() => window.canvasTest.perf());
      console.log(
        `${name} ${backend} bell: ${us.toFixed(1)} µs/frame (step + draw, 600 frames, median of 3)`,
      );
      metrics.push({ perf: 'bell', backend, microseconds: us });
      expect(us).toBeGreaterThan(0);
    });
  });
