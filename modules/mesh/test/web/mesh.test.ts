import '@anima-format/core/all';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { chromium, firefox, type Browser } from 'playwright-core';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { load, Player } from '@anima-format/core';
import { frameSVG, LIGHT, toPNG } from '../../../../packages/cli/src/render.ts';
import { bundle } from '../../../../tools/browser-build.ts';
import type {} from '../web-harness.ts';
const doc = JSON.parse(readFileSync('spec/conformance/rigging-mesh-animation/case.ani', 'utf8'));
const entry = resolve('modules/mesh/test/web-harness.ts');
const [source, reversed] = await Promise.all([
  bundle(entry),
  bundle({
    contents: [
      ...['index', 'canvas-mesh', 'mesh', 'bind', 'assets', 'paint'].map(
        (e) => `import './packages/web/src/${e}.ts';`,
      ),
      "import './modules/mesh/test/web-harness.ts';",
    ].join('\n'),
    resolveDir: process.cwd(),
  }),
]);
for (const [name, engine, paths] of [
  [
    'chromium',
    chromium,
    [
      resolve(
        homedir(),
        '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
      ),
      chromium.executablePath(),
    ],
  ],
  [
    'firefox',
    firefox,
    [
      resolve(homedir(), '.cache/ms-playwright/firefox-1555/firefox/firefox'),
      firefox.executablePath(),
    ],
  ],
] as const)
  describe(name, () => {
    let browser: Browser;
    beforeAll(async () => {
      browser = await engine.launch({ headless: true, executablePath: paths.find(existsSync) });
    }, 30000);
    afterAll(async () => {
      await browser?.close();
    }, 30000);
    it('shows an undeformed SVG image and exactly one diagnostic per node', async () => {
      const page = await browser.newPage();
      try {
        await page.setContent('<style>body{margin:0;background:white}</style>');
        await page.addScriptTag({ type: 'module', content: source });
        await page.evaluate(async (doc) => {
          await window.meshHarness.mount(doc, 'svg', 0.5);
          window.meshHarness.icon!.invalidate();
          window.meshHarness.icon!.invalidate();
        }, doc);
        const errors = await page.evaluate(() => window.meshHarness.errors);
        expect(errors).toEqual([
          expect.objectContaining({
            code: 'unsupported-render',
            feature: 'mesh',
            pointer: '/nodes/0/mesh',
            hint: expect.stringContaining('renderer="canvas"'),
          }),
        ]);
        expect(await page.locator('anima-icon').locator('svg image').getAttribute('x')).toBe('0');
        const plain = structuredClone(doc);
        delete plain.nodes[0].mesh;
        delete plain.timelines;
        delete plain.machine;
        delete plain.bind;
        delete plain.inputs;
        const actual = await page.locator('anima-icon').screenshot();
        await page.evaluate(async (plain) => window.meshHarness.mount(plain, 'svg', 0), plain);
        await expect
          .poll(async () => Buffer.compare(await page.locator('anima-icon').screenshot(), actual))
          .toBe(0);
      } finally {
        await page.close();
      }
    }, 30000);
    it('loads separate optional modules in reverse dependency arrival order', async () => {
      const page = await browser.newPage();
      try {
        await page.setContent('<style>body{margin:0;background:white}</style>');
        await page.addScriptTag({ type: 'module', content: reversed });
        await page.evaluate(async (doc) => window.meshHarness.mount(doc, 'canvas', 0.5), doc);
        expect(await page.evaluate(() => window.meshHarness.errors)).toEqual([]);
        const actual = PNG.sync.read(await page.locator('anima-icon').screenshot());
        expect(
          Array.from(actual.data.slice((80 * 240 + 30) * 4, (80 * 240 + 30) * 4 + 3)),
        ).not.toEqual([255, 255, 255]);
      } finally {
        await page.close();
      }
    }, 30000);
    it.each([0, 0.25, 0.5, 1])(
      'canvas vs CLI triangle render at %s seconds',
      async (at) => {
        const page = await browser.newPage({ deviceScaleFactor: 1 });
        try {
          await page.setContent('<style>body{margin:0;background:white}</style>');
          await page.addScriptTag({ type: 'module', content: source });
          await page.evaluate(async ({ doc, at }) => window.meshHarness.mount(doc, 'canvas', at), {
            doc,
            at,
          });
          const p = new Player(load(doc).model!);
          p.step(at);
          const expected = PNG.sync.read(toPNG(frameSVG(p, { ...LIGHT, background: '#fff' }, 240)));
          const actual = PNG.sync.read(await page.locator('anima-icon').screenshot());
          let max = 0,
            over = 0;
          for (let k = 0; k < actual.data.length; k += 4) {
            let d = 0;
            for (let c = 0; c < 4; c++)
              d = Math.max(d, Math.abs(actual.data[k + c]! - expected.data[k + c]!));
            max = Math.max(max, d);
            if (d > 16) over++;
          }
          const percent = (100 * over) / (240 * 240);
          // The canvas corpus's curved/path geometry tolerance, fixed before measurements.
          const dir = 'modules/mesh/test/web/artifacts';
          mkdirSync(dir, { recursive: true });
          writeFileSync(`${dir}/${name}-${at}.json`, JSON.stringify({ max, over, percent }) + '\n');
          writeFileSync(`${dir}/${name}-${at}.png`, PNG.sync.write(actual));
          expect(max).toBeLessThanOrEqual(128);
          expect(percent).toBeLessThanOrEqual(0.5);
          expect(await page.evaluate(() => window.meshHarness.errors)).toEqual([]);
        } finally {
          await page.close();
        }
      },
      30000,
    );
  });
