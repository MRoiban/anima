// Rottweiler P6 regressions (design/rottweiler/P6-LEDGER.md).
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type { text } from '../../core/index.ts';
import { testFont } from '../../../../tools/test-font.ts';
const doc = {
  anima: '0.1',
  name: 'text-paint-animation',
  grid: 20,
  requires: ['text', 'paint'],
  nodes: [
    {
      id: 'label',
      type: 'text',
      fill: { color: '#ff0000' },
      styles: { s: { size: 4 } },
      runs: [{ id: 'value', style: 's', text: 'AB' }],
    },
  ],
  timelines: {
    t: {
      duration: 0.05,
      tracks: {
        'label.fill.color': [
          [0, '#ff0000'],
          [0.05, '#0000ff'],
        ],
      },
    },
  },
  machine: { layers: { l: { initial: 's', states: { s: { play: 't' } } } } },
};
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
] as const) {
  it.skipIf(!existsSync(executablePath))(
    `${name}: R1-01 retained SVG text follows animated paint without a layout change`,
    async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent('<anima-icon style="width:100px;height:100px"></anima-icon>');
        for (const entry of ['index', 'paint', 'text'])
          await page.addScriptTag({
            type: 'module',
            content: await cachedBundle(resolve('packages/web/src/' + entry + '.ts')),
          });
        await page.waitForFunction(
          () => !!(customElements.get('anima-icon') as typeof AnimaIcon).modules.get('text'),
        );
        const fills = () =>
          page.evaluate(() => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            return [...icon.shadowRoot!.querySelectorAll('tspan')].map((t) =>
              t.getAttribute('fill'),
            );
          });
        const first = await page.evaluate((d) => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const diagnostics = icon.load(d);
          return {
            diagnostics,
            fill: icon.shadowRoot!.querySelector('tspan')?.getAttribute('fill'),
          };
        }, doc);
        expect(first.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        expect(first.fill).toBe('#ff0000');
        await expect.poll(fills, { timeout: 5000 }).toEqual(['#0000ff']);
      } finally {
        await browser.close();
      }
    },
    30000,
  );
  it.skipIf(!existsSync(executablePath))(
    `${name}: R3-03 a CSS font finishing loading relayouts nested component text too`,
    async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.route('http://font.test/late.ttf', (r) =>
          r.fulfill({
            body: testFont(),
            headers: { 'access-control-allow-origin': '*', 'content-type': 'font/ttf' },
          }),
        );
        await page.setContent('<anima-icon paused></anima-icon>');
        for (const entry of ['components', 'text'])
          await page.addScriptTag({
            type: 'module',
            content: await cachedBundle(resolve('packages/web/src/' + entry + '.ts')),
          });
        await page.waitForFunction(() =>
          ['components', 'text'].every((n) =>
            (customElements.get('anima-icon') as typeof AnimaIcon).modules.has(n),
          ),
        );
        const result = await page.evaluate(async () => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const module = (customElements.get('anima-icon') as typeof AnimaIcon).modules.get(
            'text',
          ) as typeof text;
          const label = {
            id: 'label',
            type: 'text',
            runs: [{ text: 'AV', style: 's' }],
            styles: { s: { font: 'Late, monospace', size: 10 } },
          };
          icon.load({
            anima: '0.1',
            name: 'late-font',
            grid: 20,
            requires: ['components', 'text'],
            components: { child: { grid: 20, nodes: [label] } },
            nodes: [label, { id: 'inst', type: 'instance', component: 'child' }],
          });
          const child = (icon.player!.nested as { players: Map<string, never> }).players.get(
            'inst',
          )!;
          const widths = () => [
            module.textLayout(icon.player!, 0).lines[0]!.width,
            module.textLayout(child, 0).lines[0]!.width,
          ];
          const before = widths();
          const done = new Promise<void>((r) =>
            document.fonts.addEventListener('loadingdone', () => r(), { once: true }),
          );
          document.fonts.add(new FontFace('Late', 'url(http://font.test/late.ttf)'));
          await document.fonts.load('10px Late', 'AV');
          await done;
          return { before, after: widths() };
        });
        expect(result.before[0]).toBe(result.before[1]);
        expect(result.after[0]).not.toBe(result.before[0]);
        expect(result.after[1]).toBe(result.after[0]);
      } finally {
        await browser.close();
      }
    },
    30000,
  );
}
