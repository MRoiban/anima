import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import { testFont } from '../../../../tools/test-font.ts';
import { featuresFont } from '../features-font.ts';
import { decodeFont } from '../../core/info.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../web/info.ts';
const bundles = await Promise.all(
  ['fonts', 'fonts-info'].map((e) => cachedBundle(resolve('packages/web/src/' + e + '.ts'))),
);
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
  it.skipIf(!existsSync(executablePath))(
    `${name} decoded FontFace metrics, coverage, options, derived outlines and import orders`,
    async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        for (const order of [
          [0, 1],
          [1, 0],
        ]) {
          const page = await browser.newPage();
          await page.setContent('<anima-icon></anima-icon>');
          for (const i of order) await page.addScriptTag({ type: 'module', content: bundles[i]! });
          await page.waitForFunction(
            () =>
              typeof (document.querySelector('anima-icon') as AnimaIcon).fonts.info === 'function',
          );
          const actual = await page.evaluate(
            async ({ base, features }) => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              const bytes = new Uint8Array(base).buffer;
              const face = await icon.fonts.decode(bytes);
              const info = await icon.fonts.info(face);
              const bold = info.derive({ axes: { wght: 900 } });
              const special = await icon.fonts.info(new Uint8Array(features).buffer);
              let rejected = false;
              try {
                await icon.fonts.info(await new FontFace('external', bytes).load());
              } catch (e) {
                rejected = (e as { code: string }).code === 'font-source';
              }
              const paths = bold.glyphs('A');
              const canvas = document.createElement('canvas');
              canvas.width = 80;
              canvas.height = 80;
              const c = canvas.getContext('2d')!;
              c.scale(0.08, -0.08);
              c.translate(0, -800);
              c.fill(new Path2D(paths[0]!.path));
              const ink = c.getImageData(0, 0, 80, 80).data.some((v, i) => i % 4 === 3 && v > 0);
              return {
                metrics: info.metrics,
                base: info.options.axes.wght,
                bold: bold.options.axes.wght,
                astral: info.hasGlyph(0x1f600),
                missing: info.hasGlyph(0x10ffff),
                paths,
                special: special.derive({ features: { liga: 0, tnum: 1 } }).glyphs('fi1'),
                rejected,
                ink,
              };
            },
            { base: [...testFont()], features: [...featuresFont()] },
          );
          const f = decodeFont(testFont());
          expect(actual).toMatchObject({
            metrics: f.metrics,
            base: 400,
            bold: 900,
            astral: true,
            missing: false,
            rejected: true,
            ink: true,
          });
          expect(actual.paths).toEqual(f.derive({ axes: { wght: 900 } }).glyphs('A'));
          expect(actual.special).toEqual(
            decodeFont(featuresFont())
              .derive({ features: { liga: 0, tnum: 1 } })
              .glyphs('fi1'),
          );
          await page.close();
        }
      } finally {
        await browser.close();
      }
    },
    30000,
  );
