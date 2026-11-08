// Rottweiler P6 regressions (design/rottweiler/P6-LEDGER.md).
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
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
] as const)
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
