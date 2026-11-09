import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import { testFont } from '../../../../tools/test-font.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../web/index.ts';
const baseline = !!process.env.ANIMA_TEXT_BASELINE;
const entries = [
  'index',
  'text',
  'input',
  'focus',
  'a11y',
  'bind',
  'text-input',
  'text-input-svg',
  'canvas',
  'text-input-canvas',
  'text-input-clipboard',
  ...(baseline ? [] : ['text-input-extra']),
];
const bundles = await Promise.all(
  entries.map((e) => cachedBundle(resolve(`packages/web/src/${e}.ts`))),
);
it('35: native reveal, selected ink, clipped caret scrolling and focused-only blink in SVG/canvas', async () => {
  const browser = await chromium.launch({
    executablePath: resolve(
      homedir(),
      '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
    ),
  });
  try {
    const page = await browser.newPage();
    await page.setContent(
      '<anima-icon style="position:relative;display:block;width:240px;height:240px"></anima-icon>',
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
    for (const renderer of ['svg', 'canvas'])
      for (const multiline of [false, true]) {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.evaluate(
          async ({ renderer, multiline, baseline }) => {
            const icon = document.querySelector('anima-icon')!;
            icon.setAttribute('renderer', renderer);
            const loaded = new Promise<void>((r) =>
              icon.addEventListener('anima:load', () => r(), { once: true }),
            );
            const errors = icon
              .load({
                anima: '0.1',
                name: 'issue35',
                grid: 20,
                requires: ['text', 'textinput', 'a11y', 'focus', 'bind'],
                inputs: baseline ? {} : { secret: { type: 'bool', default: false } },
                bind: baseline ? {} : { 'q.textInput.obscured': 'secret' },
                nodes: [
                  {
                    id: 'q',
                    type: 'text',
                    x: 2,
                    y: 2,
                    sizing: 'fixed',
                    width: 5,
                    height: 2,
                    styles: { s: { font: 'Anima Test', size: 2, fill: { color: '#0000ff' } } },
                    runs: [{ text: multiline ? 'AB\nCD\nEF\nGH' : 'ABCDEFGH', style: 's' }],
                    textInput: {
                      multiline,
                      ...(baseline ? {} : { caretBlink: !multiline }),
                      selectionColor: '#00ff00',
                      ...(baseline ? {} : { selectionTextColor: '#ff0000' }),
                    },
                  },
                ],
              })
              .filter((d) => d.severity === 'error');
            if (errors.length) throw Error(JSON.stringify(errors));
            await loaded;
            const field = icon.textInput('q')!;
            field.focus();
            field.setSelectionRange(field.value.length, field.value.length);
            field.dispatchEvent(new Event('select'));
            icon.player!.step(0);
            icon.invalidate();
          },
          { renderer, multiline, baseline },
        );
        const read = () =>
          page.evaluate(() => {
            const icon = document.querySelector('anima-icon')!;
            const field = icon.textInput('q')!;
            const m = (customElements.get('anima-icon') as typeof AnimaIcon).modules.get(
              'textinput',
            ) as typeof import('../../core/index.ts').textinput;
            const f = m.field(icon.player!, 'q')!;
            const svg = icon.shadowRoot!.querySelector('svg');
            return {
              start: f.start,
              end: f.end,
              type: field.tagName === 'INPUT' ? (field as HTMLInputElement).type : 'textarea',
              hidden: !!f.caretHidden,
              clip: !!svg?.querySelector('clipPath'),
              field: field.getBoundingClientRect().toJSON(),
              tspans: [...(svg?.querySelectorAll('tspan') ?? [])].map((t) => ({
                text: t.textContent,
                fill: getComputedStyle(t).fill,
                x: t.getAttribute('x'),
                y: t.getAttribute('y'),
              })),
            };
          });
        const proof = process.env.ANIMA_TEXT_PROOF;
        if (proof && renderer === 'svg' && !multiline) {
          mkdirSync('design/issues/proof', { recursive: true });
          await page
            .locator('anima-icon')
            .screenshot({ path: `design/issues/proof/35-${proof}.png` });
          writeFileSync(
            `design/issues/proof/35-${proof}-measurements.json`,
            JSON.stringify(await read(), null, 2) + '\n',
          );
        }
        if (renderer === 'svg') expect((await read()).clip).toBe(true);
        // The last visible glyph must be painted even though its unscrolled position is outside the box.
        const pixels = () =>
          page
            .locator('anima-icon')
            .screenshot()
            .then((b) => PNG.sync.read(b));
        await expect
          .poll(async () => {
            const png = await pixels();
            let blue = 0,
              outside = 0;
            for (let y = 0; y < png.height; y++)
              for (let x = 0; x < png.width; x++) {
                const at = (y * png.width + x) * 4;
                if (
                  png.data[at] === 0 &&
                  png.data[at + 1] === 0 &&
                  png.data[at + 2] === 255 &&
                  png.data[at + 3] === 255
                ) {
                  blue++;
                  if (x < 24 || x >= 84 || y < 24 || y >= 48) outside++;
                }
              }
            return blue > 20 && outside === 0;
          })
          .toBe(true);
        if (!multiline) {
          await page.evaluate(() => {
            const icon = document.querySelector('anima-icon')!;
            const f = icon.textInput('q')!;
            f.setSelectionRange(1, 3, 'backward');
            f.dispatchEvent(new Event('select'));
            icon.player!.set('secret', true);
            icon.player!.step(0);
            icon.invalidate();
          });
          await expect.poll(async () => (await read()).type).toBe('password');
          expect(
            await page.evaluate(() => {
              const icon = document.querySelector('anima-icon')!;
              const f = icon.textInput('q')!;
              return [
                f.selectionStart,
                f.selectionEnd,
                f.selectionDirection,
                icon.clipboardText('q'),
              ];
            }),
          ).toEqual([1, 3, 'backward', '']);
          await page.evaluate(() => {
            const icon = document.querySelector('anima-icon')!;
            icon.player!.set('secret', false);
            icon.player!.step(0);
            icon.invalidate();
          });
          await expect.poll(async () => (await read()).type).toBe('text');
          await expect
            .poll(async () => {
              const png = await pixels();
              let red = 0;
              for (let i = 0; i < png.data.length; i += 4)
                if (
                  png.data[i] === 255 &&
                  png.data[i + 1] === 0 &&
                  png.data[i + 2] === 0 &&
                  png.data[i + 3] === 255
                )
                  red++;
              return red;
            })
            .toBeGreaterThan(20);
        }
        // Focused blink repaints without keeping Player.step or the shared rAF loop busy.
        await page.evaluate(() => {
          const icon = document.querySelector('anima-icon')!;
          const f = icon.textInput('q')!;
          f.setSelectionRange(0, 0);
          f.dispatchEvent(new Event('select'));
          icon.invalidate();
        });
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        if (multiline) {
          await page.waitForTimeout(650);
          expect((await read()).hidden).toBe(false);
        } else {
          await expect.poll(async () => (await read()).hidden, { timeout: 4000 }).toBe(true);
          await page.evaluate(() =>
            document.querySelector('anima-icon')!.setAttribute('paused', ''),
          );
          await expect.poll(async () => (await read()).hidden).toBe(false);
          await page.evaluate(() =>
            document.querySelector('anima-icon')!.removeAttribute('paused'),
          );
        }
        await page.evaluate(() => {
          const icon = document.querySelector('anima-icon')!;
          const f = icon.textInput('q')!;
          f.setSelectionRange(1, 1);
          f.dispatchEvent(new Event('select'));
          icon.invalidate();
        });
        expect((await read()).hidden).toBe(false);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect.poll(async () => (await read()).hidden).toBe(false);
        await page.evaluate(() => document.querySelector('anima-icon')!.textInput('q')!.blur());
        expect(
          await page.evaluate(() => document.querySelector('anima-icon')!.player!.step(1).settled),
        ).toBe(true);
        await page.waitForTimeout(150);
        const revision = await page.evaluate(
          () => document.querySelector('anima-icon')!.player!.drawRevision,
        );
        await page.waitForTimeout(1100);
        expect(
          await page.evaluate(() => document.querySelector('anima-icon')!.player!.drawRevision),
        ).toBe(revision);
      }
  } finally {
    await browser.close();
  }
}, 30000);
