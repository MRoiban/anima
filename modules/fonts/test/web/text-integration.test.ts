import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import { testFont } from '../../../../tools/test-font.ts';
import { testFont as staticFont } from '../font.ts';
import { Font } from '../../../../packages/cli/src/font/reader.ts';
import { ToolMeasurer } from '../../../../packages/cli/src/font/measure.ts';
import { layoutText } from '../../../text/core/layout.ts';
import { registerTextMeasurer } from '../../../text/core/measure.ts';
import type { TextModule } from '../../../text/core/index.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';

const input = {
  runs: [{ text: 'AV AV\nAAA', style: 's' }],
  styles: { s: { font: 'body', size: 2 } },
  width: 3,
  height: 10,
  lineHeight: 1.2,
};
const tool = new ToolMeasurer();
tool.register('body', new Font(testFont()));
registerTextMeasurer(tool);
const expected = layoutText(input);
const automatic = layoutText({ ...input, lineHeight: 0 });
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
  for (const order of [
    ['assets', 'fonts-text', 'text'],
    ['fonts-text', 'text', 'assets'],
  ])
    it.skipIf(!existsSync(executablePath))(
      `${name} fonts/text ${order.join('→')}: readiness, layout, replacements and image catalogs`,
      async () => {
        const browser = await engine.launch({ executablePath, headless: true });
        try {
          const page = await browser.newPage();
          await page.setContent('<anima-icon paused></anima-icon><anima-icon paused></anima-icon>');
          for (const entry of ['paint', 'components', 'data', 'host', 'host-edit', ...order]) {
            if (entry === 'fonts-text')
              await page.evaluate(() => {
                const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
                const prior = Icon.loadAssets;
                const sentinel = () => false;
                Icon.loadAssets = async (icon, model) =>
                  model.doc.name === 'cache-probe' ? sentinel : prior?.(icon, model);
                (window as unknown as { fontCacheProbe: () => Promise<boolean> }).fontCacheProbe =
                  async () => {
                    const model = {
                      doc: { name: 'cache-probe', requires: [] },
                      nodes: [],
                    } as unknown as NonNullable<AnimaIcon['player']>['model'];
                    return (
                      (await Icon.loadAssets!(
                        document.querySelector('anima-icon') as AnimaIcon,
                        model,
                      )) === sentinel
                    );
                  };
              });
            await page.addScriptTag({
              type: 'module',
              content: await cachedBundle(resolve('packages/web/src/' + entry + '.ts')),
            });
            await page.waitForFunction(() => !!customElements.get('anima-icon'));
            if (entry === 'fonts-text') {
              await page.waitForFunction(
                () =>
                  !!(
                    (customElements.get('anima-icon') as typeof AnimaIcon).modules.get('fonts') as {
                      prepareText?: unknown;
                    }
                  )?.prepareText,
              );
              expect(
                await page.evaluate(() =>
                  (
                    window as unknown as { fontCacheProbe: () => Promise<boolean> }
                  ).fontCacheProbe(),
                ),
              ).toBe(true);
            }
          }
          await page.waitForFunction(() => {
            const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
            return (
              ['text', 'assets', 'paint'].every((name) => Icon.modules.has(name)) &&
              !!(Icon.modules.get('fonts') as { prepareText?: unknown }).prepareText
            );
          });
          const errors: string[] = [];
          page.on('pageerror', (e) => errors.push(e.message));
          const initial = await page.evaluate(
            async ({ bytes, input }) => {
              const icons = [...document.querySelectorAll('anima-icon')] as AnimaIcon[];
              const doc = {
                anima: '0.1',
                name: 'text-font-integration',
                grid: 20,
                requires: ['text', 'fonts', 'assets', 'paint'],
                assets: {
                  body: { type: 'font', source: 'body.ttf' },
                  photo: { type: 'image', source: 'photo.svg' },
                },
                inputs: { queued: { type: 'bool', default: false } },
                nodes: [
                  { id: 'label', type: 'text', ...input },
                  { id: 'other', type: 'text', ...input, y: 10 },
                  { id: 'automatic', type: 'text', ...input, lineHeight: 0 },
                  { id: 'image', type: 'image', asset: 'photo', x0: 0, y0: 0, width: 2, height: 3 },
                ],
              };
              const calls: string[] = [];
              const gate = new Promise<void>((resolve) =>
                document.addEventListener('release-fonts', () => resolve(), { once: true }),
              );
              for (const icon of icons) {
                icon.assets = async (name) =>
                  name === 'body'
                    ? new Blob([new Uint8Array(bytes)], { type: 'font/ttf' })
                    : new Blob(
                        [
                          '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"><rect width="2" height="3" fill="red"/></svg>',
                        ],
                        { type: 'image/svg+xml' },
                      );
                const ready = icon.fonts.ready.bind(icon.fonts);
                icon.fonts.ready = async (spec, text) => {
                  calls.push(text ?? '');
                  if (icon === icons[0]) await gate;
                  await ready(spec, text);
                };
                await new Promise<void>((res, rej) => {
                  icon.addEventListener('anima:load', () => res(), { once: true });
                  icon.addEventListener(
                    'anima:error',
                    (e) => rej(new Error(JSON.stringify((e as CustomEvent).detail))),
                    { once: true },
                  );
                  icon.load(doc);
                });
                icon.player!.set('queued', true);
              }
              return {
                calls,
                pending: icons[0]!.shadowRoot!.querySelectorAll('tspan').length === 0,
              };
            },
            { bytes: [...testFont()], input },
          );
          expect(initial.pending).toBe(true);
          await page.evaluate(() => document.dispatchEvent(new Event('release-fonts')));
          await page.waitForFunction(() =>
            [...document.querySelectorAll('anima-icon')].every(
              (icon) => icon.shadowRoot!.querySelectorAll('tspan').length === 9,
            ),
          );
          const result = await page.evaluate(() => {
            const icons = [...document.querySelectorAll('anima-icon')] as AnimaIcon[];
            const Icon = icons[0]!.constructor as typeof AnimaIcon;
            const text = Icon.modules.get('text') as TextModule;
            const assets = Icon.modules.get(
              'assets',
            ) as typeof import('../../../assets/core/index.ts').assets;
            return icons.map((icon) => ({
              layout: text.textLayout(icon.player!, 0),
              automatic: text.textLayout(icon.player!, 2),
              family: icon.shadowRoot!.querySelector('tspan')!.getAttribute('font-family'),
              queued: icon.player!.get('queued'),
              photo: assets.resolvedAssets.get(icon.player!)!.photo,
            }));
          });
          expect(initial.calls).toContain(input.runs[0]!.text);
          for (const resultIcon of result) {
            expect(resultIcon.queued).toBe(false);
            // Retained finding: Canvas has no separate OpenType lineGap. Do not widen the position tolerance.
            expect(
              automatic.lines[0]!.baseline - resultIcon.automatic.lines[0]!.baseline,
            ).toBeCloseTo(0.1, 5);
            expect(
              automatic.lines[1]!.baseline - resultIcon.automatic.lines[1]!.baseline,
            ).toBeCloseTo(0.3, 5);
            expect(resultIcon.family).toContain('anima-font-');
            expect(resultIcon.photo).toMatchObject({ width: 2, height: 3 });
            expect(resultIcon.photo.source).toMatch(/^data:image\/svg\+xml/);
            expect(
              resultIcon.layout.lines.map((l) => l.clusters.map((c) => c.text).join('')),
            ).toEqual(expected.lines.map((l) => l.clusters.map((c) => c.text).join('')));
            expected.lines.forEach((line, li) =>
              line.clusters.forEach((cluster, ci) => {
                const got = resultIcon.layout.lines[li]!.clusters[ci]!;
                expect(Math.abs(got.x - cluster.x)).toBeLessThanOrEqual(0.005 * cluster.font.size);
                expect(Math.abs(got.y - cluster.y)).toBeLessThanOrEqual(0.005 * cluster.font.size);
              }),
            );
          }
          expect(result[0]!.family).not.toBe(result[1]!.family);
          await page.evaluate(async (wide) => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            await icon.fonts.set('body', new Uint8Array(wide).buffer);
            icon.attributeChangedCallback('renderer', null, null);
          }, staticFont(900));
          await page.waitForFunction(() => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            const text = (icon.constructor as typeof AnimaIcon).modules.get('text') as TextModule;
            return (
              Math.abs(
                (text.textLayout(icon.player!, 0).lines[0]?.clusters[0]?.advance ?? 0) - 1.8,
              ) <= 0.01
            );
          });
          const widths = await page.evaluate(() =>
            [...document.querySelectorAll('anima-icon')].map((el) => {
              const icon = el as AnimaIcon;
              return (
                (icon.constructor as typeof AnimaIcon).modules.get('text') as TextModule
              ).textLayout(icon.player!, 0).lines[0]!.clusters[0]!.advance;
            }),
          );
          expect(Math.abs(widths[0]! - 1.8)).toBeLessThanOrEqual(0.01);
          expect(Math.abs(widths[1]! - 1.2)).toBeLessThanOrEqual(0.01);
          expect(errors).toEqual([]);
        } finally {
          await browser.close();
        }
      },
      30000,
    );
