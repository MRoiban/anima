import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import { testFont } from '../font.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type { TextModule } from '../../../text/core/index.ts';
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
    `${name} bound font data and nested font catalogs refresh independently`,
    async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent('<anima-icon paused auto-bind></anima-icon>');
        for (const entry of [
          'assets',
          'components',
          'data',
          'bind',
          'host',
          'host-edit',
          'fonts-text',
          'text',
        ])
          await page.addScriptTag({
            type: 'module',
            content: await cachedBundle(resolve('packages/web/src/' + entry + '.ts')),
          });
        await page.waitForFunction(
          () => !!(customElements.get('anima-icon') as typeof AnimaIcon).modules.get('text'),
        );
        await page.evaluate(
          async ({ normal, wide }) => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            const asset = (bytes: number[]) => ({
              type: 'font',
              source: 'data:font/ttf;base64,' + btoa(String.fromCharCode(...bytes)),
            });
            const label = {
              id: 'label',
              type: 'text',
              width: 20,
              height: 5,
              styles: { s: { font: 'body', size: 2 } },
              runs: [{ text: 'AAA', style: 's' }],
            };
            await new Promise<void>((res, rej) => {
              icon.addEventListener('anima:load', () => res(), { once: true });
              icon.addEventListener(
                'anima:error',
                (e) => rej(new Error(JSON.stringify((e as CustomEvent).detail))),
                { once: true },
              );
              icon.load({
                anima: '0.1',
                name: 'nested-font',
                grid: 20,
                requires: ['text', 'fonts', 'assets', 'data', 'bind', 'components'],
                assets: { body: asset(normal) },
                data: {
                  models: {
                    Root: {
                      properties: {
                        face: { type: 'asset-ref', assetType: 'font', default: 'body' },
                        title: { type: 'string', default: 'AAA' },
                      },
                    },
                  },
                },
                bind: { 'label.styles.s.font': '$face' },
                nodes: [
                  { ...label, runs: [{ text: '$title', style: 's' }] },
                  { id: 'a', type: 'instance', component: 'child' },
                  { id: 'b', type: 'instance', component: 'child' },
                ],
                components: { child: { grid: 20, assets: { body: asset(wide) }, nodes: [label] } },
              });
            });
          },
          { normal: testFont(), wide: testFont(900) },
        );
        await page.waitForFunction(
          () =>
            document.querySelector('anima-icon')!.shadowRoot!.querySelectorAll('tspan').length ===
            3,
        );
        const snapshot = () =>
          page.evaluate(() => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            const text = (icon.constructor as typeof AnimaIcon).modules.get('text') as TextModule;
            const players = [
              icon.player!,
              ...(
                icon.player!.nested as unknown as {
                  players: Map<string, NonNullable<AnimaIcon['player']>>;
                }
              ).players.values(),
            ];
            return players.map((p) => text.textLayout(p, 0).lines[0]?.width ?? 0);
          });
        const first = await snapshot();
        expect(first[0]).toBeCloseTo(3.6, 2);
        expect(first[1]).toBeCloseTo(5.4, 2);
        expect(first[2]).toBeCloseTo(5.4, 2);
        await page.evaluate(async (bytes) => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const face = await icon.fonts.decode(new Uint8Array(bytes).buffer);
          await icon.data.font('$face').set(face);
          icon.player!.step(0);
          icon.attributeChangedCallback('renderer', null, null);
        }, testFont(1200));
        await expect
          .poll(snapshot)
          .toEqual(expect.arrayContaining([expect.closeTo(7.2, 2), expect.closeTo(5.4, 2)]));
        await page.evaluate(async (bytes) => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const child = (
            icon.player!.nested as unknown as {
              players: Map<string, NonNullable<AnimaIcon['player']>>;
            }
          ).players.get('a')!;
          await icon.fonts.forModel(child.model).set('body', new Uint8Array(bytes).buffer);
          icon.attributeChangedCallback('renderer', null, null);
        }, testFont());
        await expect
          .poll(() =>
            page.evaluate(() => {
              const spans = [
                ...document.querySelector('anima-icon')!.shadowRoot!.querySelectorAll('tspan'),
              ];
              return (
                spans.length === 3 &&
                spans.every(
                  (span, i) =>
                    Math.abs(
                      (span as SVGTextContentElement).getComputedTextLength() - [7.2, 3.6, 3.6][i]!,
                    ) <= 0.01,
                )
              );
            }),
          )
          .toBe(true);
        // CSS-only scenes never run asset initializers, including hosts inside shadow roots.
        await page.evaluate(async (bytes) => {
          document.querySelector('anima-icon')!.remove();
          const root = document.body
            .appendChild(document.createElement('div'))
            .attachShadow({ mode: 'open' });
          const icon = root.appendChild(document.createElement('anima-icon')) as AnimaIcon;
          icon.setAttribute('paused', '');
          await icon.fonts.add(await icon.fonts.decode(new Uint8Array(bytes).buffer));
          const label = {
            id: 'label',
            type: 'text',
            styles: { s: { font: 'absent', size: 2 } },
            runs: [{ text: 'AAA', style: 's' }],
          };
          await new Promise<void>((res, rej) => {
            icon.addEventListener('anima:load', () => res(), { once: true });
            icon.addEventListener(
              'anima:error',
              (e) => rej(new Error(JSON.stringify((e as CustomEvent).detail))),
              { once: true },
            );
            icon.load({
              anima: '0.1',
              name: 'css-font',
              grid: 20,
              requires: ['text', 'fonts', 'components'],
              nodes: [label, { id: 'child', type: 'instance', component: 'chip' }],
              components: { chip: { grid: 20, nodes: [label] } },
            });
          });
        }, testFont(1200));
        await expect
          .poll(() =>
            page.evaluate(() => {
              const root = document.querySelector('div')!.shadowRoot!;
              const icon = root.querySelector('anima-icon')!;
              const spans = [...icon.shadowRoot!.querySelectorAll('tspan')];
              return (
                spans.length === 2 &&
                spans.every(
                  (span) =>
                    Math.abs((span as SVGTextContentElement).getComputedTextLength() - 7.2) <= 0.01,
                )
              );
            }),
          )
          .toBe(true);
      } finally {
        await browser.close();
      }
    },
    30000,
  );
