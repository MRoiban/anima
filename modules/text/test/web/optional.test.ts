import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import { bundle } from '../../../../tools/browser-build.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type { TextModule } from '../../core/index.ts';
import type { FontModule } from '../../../fonts/core/index.ts';
import type {} from './measure-entry.ts';

const consumer = bundle(resolve('modules/text/test/web/measure-entry.ts'));
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
    `${name} optional text entries share layout, caches and the registered measurer across bundles`,
    async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent('<anima-icon paused></anima-icon>');
        for (const entry of ['fonts', 'text'])
          await page.addScriptTag({
            type: 'module',
            content: await cachedBundle(resolve(`packages/web/src/${entry}.ts`)),
          });
        await page.addScriptTag({ type: 'module', content: await consumer });
        await page.waitForFunction(
          () =>
            !!window.animaMeasureText &&
            !!(
              (customElements.get('anima-icon') as typeof AnimaIcon).modules.get(
                'fonts',
              ) as FontModule
            )?.setMeasurer,
        );
        const measured = await page.evaluate(async () => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const Icon = icon.constructor as typeof AnimaIcon;
          (Icon.modules.get('fonts') as FontModule).setMeasurer!(window.animaTestMeasurer);
          const loaded = new Promise<void>((r) =>
            icon.addEventListener('anima:load', () => r(), { once: true }),
          );
          icon.load({
            anima: '0.1',
            name: 'optional-text',
            grid: 20,
            requires: ['text'],
            nodes: [
              {
                id: 'label',
                type: 'text',
                width: 3,
                height: 10,
                wrap: false,
                runs: [{ text: 'AAAAAA' }],
              },
            ],
          });
          await loaded;
          const text = Icon.modules.get('text') as TextModule;
          const before = text.textLayout(icon.player!, 0);
          const plain = window.animaMeasureText(icon.player!, 'label');
          const constrained = window.animaMeasureText(icon.player!, 'label', 2);
          return {
            plain,
            constrained,
            unchanged: before === text.textLayout(icon.player!, 0),
            authored: icon.player!.model.doc.nodes[0]!.width,
          };
        });
        expect(measured).toEqual({
          plain: { width: 3, height: 10, baseline: 0.8 },
          constrained: { width: 2, height: 10, baseline: 0.8 },
          unchanged: true,
          authored: 3,
        });
        await page.addScriptTag({
          type: 'module',
          content: await cachedBundle(resolve('packages/web/src/text-overflow.ts')),
        });
        await page.waitForFunction(
          () =>
            !!(
              (customElements.get('anima-icon') as typeof AnimaIcon).modules.get(
                'text',
              ) as TextModule
            )?.overflow,
        );
        const overflow = await page.evaluate(async () => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const Icon = icon.constructor as typeof AnimaIcon;
          const text = Icon.modules.get('text') as TextModule;
          const font = Icon.modules.get('fonts') as FontModule;
          // The addon must measure ellipsis with this active custom measurer, not a bundled copy.
          font.setMeasurer!({
            measure(spec, source) {
              const metrics = window.animaTestMeasurer.measure(spec, source);
              if (source === '…') metrics.advances[0] = 0.25;
              return metrics;
            },
          });
          const results = [];
          for (const mode of ['fit', 'ellipsis']) {
            const doc = structuredClone(icon.player!.model.doc);
            doc.nodes[0]!.overflow = mode;
            const loaded = new Promise<void>((r) =>
              icon.addEventListener('anima:load', () => r(), { once: true }),
            );
            icon.load(doc);
            await loaded;
            const layout = text.textLayout(icon.player!, 0);
            results.push({
              scale: layout.scale,
              width: layout.lines[0]!.width,
              string: layout.lines[0]!.clusters.map((c) => c.text).join(''),
            });
          }
          return results;
        });
        expect(overflow).toEqual([
          { scale: 0.5, width: 3, string: 'AAAAAA' },
          { scale: 1, width: 2.25, string: 'AA…' },
        ]);
      } finally {
        await browser.close();
      }
    },
    30000,
  );
