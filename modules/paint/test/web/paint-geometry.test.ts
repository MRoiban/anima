import '@anima-format/core/all';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type BrowserType } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import { compile } from '../../../../packages/markup/src/index.ts';
import { load, Player, toSVG } from '../../../../packages/core/src/index.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';

const browsers: [string, BrowserType, string | undefined][] = [
  [
    'Chromium',
    chromium,
    process.env.CHROMIUM_PATH ??
      [
        resolve(
          homedir(),
          '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
        ),
        chromium.executablePath(),
      ].find(existsSync),
  ],
  [
    'Firefox',
    firefox,
    process.env.FIREFOX_PATH ??
      [
        resolve(homedir(), '.cache/ms-playwright/firefox-1555/firefox/firefox'),
        firefox.executablePath(),
      ].find(existsSync),
  ],
];
for (const [name, type, executablePath] of browsers) {
  describe.skipIf(!executablePath)(name + ' paint geometry', () => {
    it('renders every shape and morph with the shared scene attributes, using absolute browser dashes', async () => {
      const browser = await type.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        const code = await bundle(resolve('packages/web/src/paint.ts'));
        const source = readFileSync(resolve('examples/shapes.animl'), 'utf8');
        const doc = compile(source).doc!;
        const dash = {
          id: 'dash',
          type: 'path',
          d: 'M1 1L19 1',
          stroke: { color: '#000', dash: ['10%', '5%'] },
        };
        (doc.nodes as unknown[]).push(dash);
        await page.route('https://anima.test/', (route) =>
          route.fulfill({
            contentType: 'text/html',
            body: '<anima-icon style="width:400px;height:400px"></anima-icon>',
          }),
        );
        await page.goto('https://anima.test/');
        await page.addScriptTag({ type: 'module', content: code });
        await page.evaluate(async (d) => {
          await customElements.whenDefined('anima-icon');
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          await icon.load(d);
          icon.pause();
        }, doc);
        const attrs = await page.locator('anima-icon').evaluate((el) => {
          const icon = el as AnimaIcon;
          icon.player!.step(0.5);
          // Host seek writes the current retained SVG frame.
          icon.invalidate();
          return [...icon.shadowRoot!.querySelectorAll('path')].map((p) => ({
            d: p.getAttribute('d'),
            effect: p.getAttribute('vector-effect'),
            length: p.getAttribute('pathLength'),
            dash: p.getAttribute('stroke-dasharray'),
            measured: p.getTotalLength(),
          }));
        });
        expect(attrs).toHaveLength(7);
        expect(attrs.every((p) => p.measured > 0)).toBe(true);
        expect(attrs[3]!.effect).toBe('non-scaling-stroke');
        expect(attrs[6]).toMatchObject({ length: null, dash: '1.8 0.9' });
        const p = new Player(load(doc).model!);
        p.step(0.5);
        const svg = toSVG(p);
        for (const a of attrs.slice(0, 6)) expect(svg).toContain('d="' + a.d + '"');
      } finally {
        await browser.close();
      }
    }, 30000);
  });
}
