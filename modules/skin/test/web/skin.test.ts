import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Page } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';

async function add(page: Page, name: string) {
  await page.addScriptTag({
    type: 'module',
    content: await cachedBundle(resolve('packages/web/src/' + name + '.ts')),
  });
  const registered: Record<string, string> = {
    'skin-auto': 'skinauto',
    'skin-dash': 'skindash',
    'skin-mesh': 'skinmesh',
    'skin-values': 'skinvalues',
  };
  await page.waitForFunction(
    ({ name, module }) => {
      const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
      return name === 'index' ? !!Icon : Icon.modules.has(module);
    },
    { name, module: registered[name] ?? name },
    { polling: 10 },
  );
}

const explicit = [{ point: { arm: 1 } }, { point: { arm: 1 } }];
const pathDoc = (weights: unknown = explicit, dash?: string[]) => ({
  anima: '0.1',
  name: 'skin-browser',
  grid: 20,
  requires: ['paint', 'rig', 'skin'],
  nodes: [
    { id: 'arm', type: 'bone', length: 10 },
    {
      id: 'line',
      type: 'path',
      d: 'M0 0L10 0',
      stroke: { color: '#000', ...(dash ? { dash } : {}) },
      skin: { bones: ['arm'], ...(weights ? { weights } : {}) },
    },
  ],
});

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
  describe(name + ' skin optional entries', () => {
    it('diagnoses missing scene features and accepts them after their entry loads', async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        for (const entry of ['index', 'paint', 'rig', 'skin']) await add(page, entry);
        const codes = async (doc: object) =>
          page.evaluate((source) => {
            const icon = document.createElement('anima-icon');
            document.body.append(icon);
            return icon.load(source).map((d) => [d.code, d.pointer]);
          }, doc);

        expect(await codes(pathDoc(null))).toContainEqual([
          'rig-skin-feature',
          '/nodes/1/skin/weights',
        ]);
        await add(page, 'skin-auto');
        expect(await codes(pathDoc(null))).toEqual([]);

        expect(await codes(pathDoc(explicit, ['10%']))).toContainEqual([
          'rig-skin-feature',
          '/nodes/1/skin',
        ]);
        await add(page, 'skin-dash');
        expect(await codes(pathDoc(explicit, ['10%']))).toEqual([]);

        for (const entry of ['assets', 'mesh']) await add(page, entry);
        const meshWeights = [...explicit, { point: { arm: 1 } }];
        const mesh = {
          anima: '0.1',
          name: 'skin-mesh-browser',
          grid: 20,
          requires: ['assets', 'mesh', 'paint', 'rig', 'skin'],
          assets: {
            pixel: {
              type: 'image',
              source:
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWP4z8DwHwAFgAI/ScLJ0QAAAABJRU5ErkJggg==',
              width: 1,
              height: 1,
            },
          },
          nodes: [
            { id: 'arm', type: 'bone', length: 10 },
            {
              id: 'image',
              type: 'image',
              asset: 'pixel',
              x0: 0,
              y0: 0,
              width: 10,
              height: 2,
              mesh: {
                vertices: [
                  [0, 0, 0, 0],
                  [10, 0, 1, 0],
                  [0, 2, 0, 1],
                ],
                triangles: [[0, 1, 2]],
              },
              skin: { bones: ['arm'], weights: meshWeights },
            },
          ],
        };
        expect(await codes(mesh)).toContainEqual(['rig-skin-feature', '/nodes/1/skin']);
        await add(page, 'skin-mesh');
        expect(await codes(mesh)).toEqual([]);
      } finally {
        await browser.close();
      }
    }, 30000);
  });
