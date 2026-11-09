import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type { SemanticNode } from '../../core/types.ts';
const entries = [
  'index',
  'a11y',
  'a11y-actions',
  'a11y-dom',
  'paint',
  'composite',
  'contour',
  'surface',
  'assets',
  'fonts',
  'text',
  'fonts-text',
  'a11y-text',
  'a11y-bounds',
  'host-fit',
];
const bundles = await Promise.all(
  entries.map((e) => cachedBundle(resolve('packages/web/src/' + e + '.ts'))),
);
const names = ['clip', 'mask', 'trim', 'trim-wrap', 'fixed', 'feather', 'dash', 'text'];
const cases = names.map((name) => {
  const root = new URL(
    '../../../../spec/conformance/a11y-tree-bounds-' + name + '/',
    import.meta.url,
  );
  const doc = JSON.parse(readFileSync(new URL('case.ani', root), 'utf8'));
  if (doc.assets)
    doc.assets['sans-serif'].source =
      'data:font/ttf;base64,' +
      readFileSync(resolve('fixtures/fonts/anima-test.ttf')).toString('base64');
  const expected = JSON.parse(readFileSync(new URL('expected.jsonl', root), 'utf8'))
    .semantics as SemanticNode[];
  // Browser metrics have no independent line gap (the existing text measurement contract).
  if (name === 'text') expected[0]!.bounds[1] = 20;
  return { name, doc, expected };
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
] as const) {
  for (const early of [false, true])
    it.skipIf(!existsSync(executablePath))(
      `${name} ${early ? 'bounds-first' : 'bounds-last'} every extent shares independent semantic and overlay bounds, including settled host resize`,
      async () => {
        const browser = await engine.launch({ executablePath, headless: true });
        try {
          const page = await browser.newPage();
          await page.setContent(
            '<anima-icon paused fit="contain" style="display:block;width:100px;height:100px"></anima-icon>',
          );
          const order = early
            ? entries.filter((e) => e !== 'a11y-dom').concat('a11y-dom')
            : entries;
          for (const entry of order)
            await page.addScriptTag({ type: 'module', content: bundles[entries.indexOf(entry)]! });
          await page.waitForFunction(() =>
            (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('contour'),
          );
          for (const { name: extent, doc, expected } of cases) {
            await page.evaluate(async (doc) => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              await new Promise<void>((resolve, reject) => {
                icon.addEventListener('anima:load', () => resolve(), { once: true });
                icon.addEventListener(
                  'anima:error',
                  (e) => reject(new Error(JSON.stringify((e as CustomEvent).detail))),
                  {
                    once: true,
                  },
                );
                icon.load(doc);
              });
              await document.fonts.ready;
              icon.flush();
              icon.invalidate();
            }, doc);
            const bounds = await page.evaluate(() => {
              const flat = (ns: SemanticNode[]): SemanticNode[] =>
                ns.flatMap((n) => [n, ...flat(n.children)]);
              return flat(
                (document.querySelector('anima-icon') as AnimaIcon).player!.semantics(),
              ).map((n) => ({ id: n.id, bounds: n.bounds }));
            });
            const flat = (ns: SemanticNode[]): SemanticNode[] =>
              ns.flatMap((n) => [n, ...flat(n.children)]);
            expect(bounds, extent).toEqual(
              flat(expected).map((n) => ({ id: n.id, bounds: n.bounds })),
            );
            await expect
              .poll(
                async () =>
                  page.evaluate(() => {
                    const icon = document.querySelector('anima-icon') as AnimaIcon;
                    const m = icon.shadowRoot!.querySelector('svg')!.getScreenCTM()!;
                    const flat = (ns: SemanticNode[]): SemanticNode[] =>
                      ns.flatMap((n) => [n, ...flat(n.children)]);
                    return flat(icon.player!.semantics()).every((n) => {
                      const el = icon.shadowRoot!.querySelector(`[data-semantic="${n.id}"]`)!;
                      const r = el.getBoundingClientRect();
                      const [x, y, w, h] = n.bounds;
                      return [
                        r.x - (x * m.a + m.e),
                        r.y - (y * m.d + m.f),
                        r.width - w * m.a,
                        r.height - h * m.d,
                      ].every((v) => Math.abs(v) < 0.001);
                    });
                  }),
                { message: extent, timeout: 5000 },
              )
              .toBe(true);
            if (extent === 'fixed') {
              await page.evaluate(() => {
                const icon = document.querySelector('anima-icon') as AnimaIcon;
                icon.style.width = icon.style.height = '200px';
              });
              await expect
                .poll(() =>
                  page.evaluate(
                    () =>
                      (document.querySelector('anima-icon') as AnimaIcon).player!.semantics()[0]!
                        .bounds,
                  ),
                )
                .toEqual([9.5, 9.5, 1, 13]);
              await expect
                .poll(() =>
                  page.evaluate(() => {
                    const el = document
                      .querySelector('anima-icon')!
                      .shadowRoot!.querySelector('[data-semantic="fixed"]') as HTMLElement;
                    return [el.style.left, el.style.top, el.style.width, el.style.height];
                  }),
                )
                .toEqual(['9.5px', '9.5px', '1px', '13px']);
              await page.evaluate(() => {
                const icon = document.querySelector('anima-icon') as AnimaIcon;
                icon.style.width = icon.style.height = '100px';
              });
              await expect
                .poll(() =>
                  page.evaluate(
                    () =>
                      (document.querySelector('anima-icon') as AnimaIcon).player!.semantics()[0]!
                        .bounds,
                  ),
                )
                .toEqual([9, 9, 2, 14]);
            }
          }
        } finally {
          await browser.close();
        }
      },
      30000,
    );
}
