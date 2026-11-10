import { readFileSync, globSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { build } from 'esbuild';
import { chromium, firefox, type Browser, type Page } from 'playwright-core';
import { PNG } from 'pngjs';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { bundle } from '../../../../tools/browser-build.ts';
import type {} from '../../../canvas/test/web/harness.ts';
const cases = globSync('spec/conformance/rigging-*/case.ani')
  .sort()
  .map((file) => ({
    name: file.split('/')[2]!,
    doc: JSON.parse(readFileSync(file, 'utf8')),
    script: readFileSync(file.replace('case.ani', 'script.txt'), 'utf8'),
  }))
  // Rig cases only, without URL-loaded assets: `rigging-mesh*` and the meshed image in
  // `rigging-skin` load images, which this page (no base URL) cannot fetch; the oracle covers them.
  .filter((c) => c.doc.requires?.includes('rig') && !c.doc.assets);
let harness: Promise<string> | undefined;
let separate: Promise<string[]> | undefined;
for (const [name, engine, relative] of [
  [
    'Chromium',
    chromium,
    'chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['Firefox', firefox, 'firefox-1555/firefox/firefox'],
] as const)
  describe(name + ' rig', () => {
    let browser: Browser, page: Page;
    beforeAll(async () => {
      browser = await engine.launch({
        executablePath: resolve(homedir(), '.cache/ms-playwright', relative),
        headless: true,
      });
      page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 });
      harness ??= build({
        entryPoints: ['modules/canvas/test/web/harness.ts'],
        bundle: true,
        format: 'esm',
        write: false,
      }).then((r) => r.outputFiles[0]!.text);
      await page.setContent('<style>body{margin:0;background:white}</style>');
      await page.addScriptTag({ type: 'module', content: await harness });
      await page.waitForFunction(() => !!window.canvasTest);
      separate ??= Promise.all(
        ['index', 'rig', 'rig-origin', 'rig-distance', 'markup-rig', 'markup-animation'].map(
          (entry) => bundle(resolve('packages/web/src/' + entry + '.ts')),
        ),
      );
      await separate;
    }, 120000);
    afterAll(async () => browser?.close());
    for (const c of cases)
      it(
        c.name + ' SVG/canvas at 0, 0.5, 1 s',
        async () => {
          const boundaries = [...c.script.matchAll(/^snapshot[^\n]*/gm)].map((m) =>
            c.script.slice(0, m.index),
          );
          for (const script of boundaries) {
            const images: PNG[] = [];
            for (const backend of ['svg', 'canvas']) {
              await page.evaluate(
                async ({ doc, backend, script }) => window.canvasTest.mount(doc, backend, script),
                { doc: c.doc, backend, script },
              );
              expect(await page.evaluate(() => window.canvasTest.errors)).toEqual([]);
              images.push(PNG.sync.read(await page.locator('anima-icon').screenshot()));
            }
            const [a, b] = images;
            expect([a!.width, a!.height]).toEqual([b!.width, b!.height]);
            let max = 0,
              over = 0;
            for (let i = 0; i < a!.data.length; i += 4) {
              let delta = 0;
              for (let k = 0; k < 4; k++)
                delta = Math.max(delta, Math.abs(a!.data[i + k]! - b!.data[i + k]!));
              max = Math.max(max, delta);
              if (delta > 16) over++;
            }
            expect(max, 'max channel delta').toBeLessThanOrEqual(128);
            expect(over / (a!.width * a!.height), 'pixels over 16').toBeLessThanOrEqual(0.005);
          }
        },
        30000,
      );
    it('reports a missing origin entry and accepts it when loaded', async () => {
      const p = await browser.newPage();
      try {
        for (const content of (await separate!).slice(0, 2))
          await p.addScriptTag({ type: 'module', content });
        const doc = {
          anima: '0.1',
          name: 'rig-origin-entry',
          grid: 20,
          requires: ['rig'],
          nodes: [
            { id: 'target', type: 'rect', x0: 1, y0: 2, w: 4, h: 2 },
            {
              id: 'host',
              type: 'group',
              constraints: [{ kind: 'copyTransform', from: 'target', origin: [1, 1] }],
            },
          ],
        };
        const load = (source: object) =>
          p.evaluate((d) => {
            const icon = document.createElement('anima-icon');
            document.body.append(icon);
            return icon.load(d);
          }, source);
        expect(await load(doc)).toContainEqual(
          expect.objectContaining({
            code: 'rig-origin',
            pointer: '/nodes/1/constraints/0/origin',
          }),
        );
        await p.addScriptTag({ type: 'module', content: (await separate!)[2]! });
        expect(await load(doc)).toEqual([]);
      } finally {
        await p.close();
      }
    }, 30000);
    it('compiles bone/constraint children with separately bundled markup-rig', async () => {
      const p = await browser.newPage();
      try {
        for (const content of await separate!) await p.addScriptTag({ type: 'module', content });
        const out = await p.evaluate(
          async (source) => {
            const icon = document.createElement('anima-icon');
            icon.setAttribute('paused', '');
            document.body.append(icon);
            const errors: unknown[] = [];
            icon.addEventListener('anima:error', (e) => errors.push((e as CustomEvent).detail));
            icon.load(source, true);
            await icon.ready;
            return {
              errors,
              types: icon.player!.model.nodes.map((n) => n.type),
              constraints: icon.player!.model.nodes.find((n) => n.id === 'pupil')!.raw.constraints,
            };
          },
          readFileSync('modules/rig/examples/arm.animl', 'utf8'),
        );
        expect(out.errors).toEqual([]);
        expect(out.types).toContain('bone');
        expect(out.constraints).toHaveLength(2);
      } finally {
        await p.close();
      }
    }, 30000);
  });
