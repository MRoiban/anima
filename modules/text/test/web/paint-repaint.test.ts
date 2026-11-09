import '@anima-format/core/all';
import { compile } from '@anima-format/markup';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import { testFont } from '../../../../tools/test-font.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
const bundles = await Promise.all(
  ['index', 'data', 'bind', 'text', 'canvas'].map((e) =>
    cachedBundle(resolve(`packages/web/src/${e}.ts`)),
  ),
);
const source = `<anima version="0.1" name="paint-repaint" grid="20" requires="text data bind">
<model name="Theme"><color name="fg" default="#cecdc3"/><color name="edge" default="#0000ff"/></model><instance name="m" model="Theme" default="true"/>
<text id="lbl" x="2" y="2" width="16" height="5" fill="#cecdc3" stroke="#0000ff" stroke-width="0.3"><style id="s" font="Anima Test" size="3"/><run text="ABCD" style="s"/></text>
<bind target="lbl.fill.color" value="$m:fg"/><bind target="lbl.stroke.color" value="$m:edge"/>
</anima>`;
it('31: retained local-style text repaints bound fill, stroke and every theme colour in both renderers', async () => {
  const result = compile(source);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const browser = await chromium.launch({
    executablePath: resolve(
      homedir(),
      '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
    ),
  });
  try {
    const page = await browser.newPage();
    await page.setContent(
      '<anima-icon paused style="display:block;width:240px;height:120px"></anima-icon>',
    );
    await page.evaluate(
      async (bytes) =>
        document.fonts.add(await new FontFace('Anima Test', new Uint8Array(bytes)).load()),
      [...testFont()],
    );
    for (const content of bundles) await page.addScriptTag({ type: 'module', content });
    await page.waitForFunction(
      () => !!(customElements.get('anima-icon') as typeof AnimaIcon).renderers.canvas,
    );
    for (const renderer of ['svg', 'canvas']) {
      await page.evaluate(
        async ({ doc, renderer }) => {
          const icon = document.querySelector('anima-icon')!;
          icon.setAttribute('renderer', renderer);
          const loaded = new Promise<void>((r) =>
            icon.addEventListener('anima:load', () => r(), { once: true }),
          );
          const errors = icon.load(doc).filter((d) => d.severity === 'error');
          if (errors.length) throw Error(JSON.stringify(errors));
          await loaded;
        },
        { doc: result.doc!, renderer },
      );
      for (const [fg, edge] of [
        ['#cecdc3', '#0000ff'],
        ['#ff0000', '#0000ff'],
        ['#00ff00', '#ff00ff'],
      ]) {
        await page.evaluate(
          ({ fg, edge }) => {
            const icon = document.querySelector('anima-icon')!;
            icon.player!.set('$m:fg', fg!);
            icon.player!.set('$m:edge', edge!);
            icon.player!.step(0);
            icon.invalidate();
          },
          { fg, edge },
        );
        const proof = process.env.ANIMA_TEXT_PROOF;
        if (proof && renderer === 'svg' && fg === '#ff0000') {
          mkdirSync('design/issues/proof', { recursive: true });
          await page
            .locator('anima-icon')
            .screenshot({ path: `design/issues/proof/31-${proof}.png` });
          writeFileSync(
            `design/issues/proof/31-${proof}-measurements.json`,
            JSON.stringify(
              await page.evaluate(() => {
                const t = document.querySelector('anima-icon')!.shadowRoot!.querySelector('tspan')!;
                return {
                  fill: getComputedStyle(t).fill,
                  stroke: getComputedStyle(t).stroke,
                  rect: t.getBoundingClientRect().toJSON(),
                };
              }),
              null,
              2,
            ) + '\n',
          );
        }
        if (renderer === 'svg') {
          const rgb = (c: string) =>
            `rgb(${parseInt(c.slice(1, 3), 16)}, ${parseInt(c.slice(3, 5), 16)}, ${parseInt(c.slice(5, 7), 16)})`;
          await expect
            .poll(() =>
              page.evaluate(() => {
                const t = document.querySelector('anima-icon')!.shadowRoot!.querySelector('tspan')!;
                return [getComputedStyle(t).fill, getComputedStyle(t).stroke, t.textContent];
              }),
            )
            .toEqual([rgb(fg!), rgb(edge!), 'ABCD']);
        } else {
          await expect
            .poll(async () => {
              const png = PNG.sync.read(await page.locator('anima-icon').screenshot());
              const counts = [fg!, edge!].map((c) => {
                const rgb = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
                let count = 0;
                for (let i = 0; i < png.data.length; i += 4)
                  if (rgb.every((v, k) => png.data[i + k] === v) && png.data[i + 3] === 255)
                    count++;
                return count;
              });
              return counts.every((c) => c > 20);
            })
            .toBe(true);
        }
      }
    }
  } finally {
    await browser.close();
  }
}, 30000);
