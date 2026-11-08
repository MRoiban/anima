import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../web/index.ts';
import type {} from '../../web/clipboard.ts';
import type {} from '../../../a11y-dom/web/index.ts';
import { readFileSync } from 'node:fs';
import { compile } from '@anima-format/markup';
const doc = compile(readFileSync('modules/text-input/examples/search-card.animl', 'utf8')).doc!;
// Resolve artifacts outside test timers: cold bundle compilation is not a browser action.
const allEntries = [
  'index',
  'components',
  'input',
  'focus',
  'a11y',
  'a11y-actions',
  'a11y-dom',
  'data',
  'bind',
  'derive',
  'convert',
  'text',
  'text-input',
  'text-input-clipboard',
  'text-input-svg',
  'canvas',
  'text-input-canvas',
];
const bundles = new Map(
  await Promise.all(
    allEntries.map(
      async (name) =>
        [name, await cachedBundle(resolve('packages/web/src/' + name + '.ts'))] as const,
    ),
  ),
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
] as const) {
  for (const reversed of [false, true])
    it.skipIf(!existsSync(executablePath))(
      `${name} fields ${reversed ? 'reverse' : 'forward'}: native editing, semantics, selection, clipboard and lifecycle`,
      async () => {
        const browser = await engine.launch({ executablePath, headless: true });
        try {
          const page = await browser.newPage();
          await page.setContent(
            '<anima-icon style="position:relative;display:block;width:400px;height:400px"></anima-icon>',
          );
          const entries = [
            'index',
            'components',
            'input',
            'focus',
            'a11y',
            'a11y-actions',
            'a11y-dom',
            'data',
            'bind',
            'derive',
            'convert',
            'text',
            'text-input',
          ];
          for (const entry of reversed ? entries.reverse() : entries)
            await page.addScriptTag({
              type: 'module',
              content: bundles.get(entry)!,
            });
          await page.addScriptTag({ type: 'module', content: bundles.get('text-input-svg')! });
          await page.addScriptTag({
            type: 'module',
            content: bundles.get('text-input-clipboard')!,
          });
          await page.waitForFunction(
            () =>
              typeof (customElements.get('anima-icon') as typeof AnimaIcon).prototype
                .clipboardText === 'function',
          );
          await page.waitForFunction(() =>
            [
              'textinput',
              'text',
              'focus',
              'a11y',
              'a11yactions',
              'data',
              'bind',
              'derive',
              'convert',
              'input',
              'components',
            ].every((name) =>
              (customElements.get('anima-icon') as typeof AnimaIcon).modules.has(name),
            ),
          );
          await page.evaluate(async (doc) => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            const loaded = new Promise<void>((r, reject) => {
              icon.addEventListener('anima:load', () => r(), { once: true });
              icon.addEventListener(
                'anima:error',
                (e) => reject(Error(JSON.stringify((e as CustomEvent).detail))),
                { once: true },
              );
            });
            icon.load({ ...doc, listeners: [{ target: 'search', on: 'text', emit: 'typed' }] });
            await loaded;
            (window as unknown as { bubbles: string[] }).bubbles = [];
            for (const e of [
              'pointerdown',
              'pointerup',
              'keydown',
              'keyup',
              'input',
              'compositionend',
              'anima:event',
            ])
              document.addEventListener(e, () => {
                (window as unknown as { bubbles: string[] }).bubbles.push(e);
              });
          }, doc);
          const input = page.locator('anima-icon input[data-semantic=search]');
          expect(await page.getByRole('textbox', { name: 'Search fruit' }).count()).toBe(1);
          await input.click();
          await page.keyboard.type('Pear');
          await expect
            .poll(() =>
              page.evaluate(() => {
                const icon = document.querySelector('anima-icon') as AnimaIcon;
                return icon.player!.get('$summary');
              }),
            )
            .toBe('1 results');
          const state = await page.evaluate(() => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            const f = icon.textInput('search')!;
            f.setSelectionRange(1, 3);
            f.dispatchEvent(new Event('select'));
            const selectionRects = icon.shadowRoot!.querySelectorAll('rect[fill="#b3d4fc"]').length;
            const copied = icon.clipboardText('search');
            const cut = icon.clipboardText('search', true);
            return {
              copied,
              selectionRects,
              cut,
              value: f.value,
              semantics: icon.player!.semantics(),
              count: icon.shadowRoot!.querySelectorAll('input[data-semantic=search]').length,
              drawn: [...icon.shadowRoot!.querySelectorAll('tspan')]
                .map((n) => n.textContent)
                .join(' '),
              bubbles: (window as unknown as { bubbles: string[] }).bubbles,
            };
          });
          expect(state).toMatchObject({
            copied: 'ea',
            cut: 'ea',
            value: 'Pr',
            count: 1,
            selectionRects: 1,
          });

          expect(state.drawn).toContain('Pr');
          for (const e of ['pointerdown', 'pointerup', 'keydown', 'keyup', 'input', 'anima:event'])
            expect(state.bubbles).toContain(e);
          await expect
            .poll(() =>
              page.evaluate(() =>
                (document.querySelector('anima-icon') as AnimaIcon).player!.get('$query'),
              ),
            )
            .toBe('Pr');
          expect(
            await page.evaluate(() =>
              (document.querySelector('anima-icon') as AnimaIcon)
                .player!.semantics()
                .find((n) => n.id === 'search'),
            ),
          ).toMatchObject({
            role: 'text-field',
            value: 'Pr',
            label: 'Search fruit',
            states: { focused: true },
          });
          const ime = await page.evaluate(() => {
            const icon = document.querySelector('anima-icon') as AnimaIcon,
              f = icon.textInput('search')!;
            f.dispatchEvent(
              new CompositionEvent('compositionstart', { bubbles: true, composed: true }),
            );
            f.value = 'Apple';
            f.setSelectionRange(5, 5);
            f.dispatchEvent(
              new InputEvent('input', { bubbles: true, composed: true, isComposing: true }),
            );
            const before = icon.player!.get('$query');
            f.dispatchEvent(
              new CompositionEvent('compositionend', {
                bubbles: true,
                composed: true,
                data: 'Apple',
              }),
            );
            return {
              before,
              after: icon.player!.get('$query'),
              summary: icon.player!.get('$summary'),
            };
          });
          expect(ime.before).toBe('Pr');
          await expect
            .poll(() =>
              page.evaluate(() =>
                (document.querySelector('anima-icon') as AnimaIcon).player!.get('$query'),
              ),
            )
            .toBe('Apple');
          // A second pointer action must preserve native caret defaults after focus is already owned.
          await input.click({ position: { x: 3, y: 5 } });
          expect(
            await input.evaluate((el) => (el as HTMLInputElement).selectionStart),
          ).toBeLessThan(5);
          await page.evaluate(() => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            icon.destroy();
          });
          expect(await input.count()).toBe(0);
        } finally {
          await browser.close();
        }
      },
      30000,
    );
  it.skipIf(!existsSync(executablePath))(
    `${name} multiline, password privacy, limits and select-on-focus`,
    async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent(
          '<anima-icon style="position:relative;display:block;width:400px;height:400px"></anima-icon>',
        );
        for (const entry of [
          'index',
          'focus',
          'a11y',
          'a11y-actions',
          'text',
          'text-input',
          'text-input-svg',
        ])
          await page.addScriptTag({
            type: 'module',
            content: bundles.get(entry)!,
          });
        await page.waitForFunction(() =>
          ['textinput', 'text', 'focus', 'a11y'].every((name) =>
            (customElements.get('anima-icon') as typeof AnimaIcon).modules.has(name),
          ),
        );
        await page.evaluate(async () => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const loaded = new Promise<void>((r) =>
            icon.addEventListener('anima:load', () => r(), { once: true }),
          );
          icon.load({
            anima: '0.1',
            name: 'fields',
            grid: 20,
            requires: ['text', 'textinput', 'focus', 'a11y'],
            nodes: [
              {
                id: 'multi',
                type: 'text',
                lineHeight: 1.8,
                sizing: 'fixed',
                width: 18,
                height: 7,
                runs: [{ text: 'abc' }],
                textInput: { multiline: true, maxLines: 2, maxLength: 8, selectOnFocus: true },
              },
              {
                id: 'password',
                type: 'text',
                y: 9,
                sizing: 'fixed',
                width: 18,
                height: 3,
                runs: [{ text: 'secret' }],
                textInput: { obscured: true },
              },
            ],
          });
          await loaded;
        });
        await page.addScriptTag({ type: 'module', content: bundles.get('text-input-clipboard')! });
        await page.waitForFunction(
          () =>
            typeof (customElements.get('anima-icon') as typeof AnimaIcon).prototype
              .clipboardText === 'function',
        );
        const result = await page.evaluate(() => {
          const icon = document.querySelector('anima-icon') as AnimaIcon,
            multi = icon.textInput('multi')!,
            pw = icon.textInput('password')!;
          multi.focus();
          const selected = [multi.selectionStart, multi.selectionEnd];
          multi.value = 'a\nb\nc';
          multi.dispatchEvent(new InputEvent('input', { bubbles: true }));
          pw.focus();
          pw.select();
          const copied = icon.clipboardText('password', true);
          const copy = new ClipboardEvent('copy', { cancelable: true, bubbles: true });
          pw.dispatchEvent(copy);
          return {
            selected,
            multiline: multi.localName,
            lineHeight: multi.style.lineHeight,
            multi: multi.value,
            pw: pw.value,
            copied,
            blocked: copy.defaultPrevented,
            type: (pw as HTMLInputElement).type,
            semantics: icon.player!.semantics(),
          };
        });
        expect(result).toMatchObject({
          selected: [0, 3],
          multiline: 'textarea',
          lineHeight: '1.8',
          multi: 'a\nb',
          pw: 'secret',
          copied: '',
          blocked: true,
          type: 'password',
        });
        expect(result.semantics.find((n) => n.id === 'password')!.value).toBeUndefined();
        expect(result.semantics.find((n) => n.id === 'multi')!.states).toMatchObject({
          multiline: true,
        });
        for (const entry of ['canvas', 'text-input-canvas'])
          await page.addScriptTag({ type: 'module', content: bundles.get(entry)! });
        await page.waitForFunction(
          () => !!(customElements.get('anima-icon') as typeof AnimaIcon).renderers.canvas,
        );
        await page.waitForFunction(
          () =>
            ((customElements.get('anima-icon') as unknown as { canvasShapes?: unknown[] })
              .canvasShapes?.length ?? 0) >= 2,
        );
        await page.evaluate(() =>
          (document.querySelector('anima-icon') as AnimaIcon).setAttribute('renderer', 'canvas'),
        );
        await page.locator('anima-icon textarea').focus();
        await page.keyboard.press('ControlOrMeta+A');
        const canvas = await page.evaluate(() => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const field = icon.textInput('multi')!;
          icon.player!.step(0);
          icon.invalidate();
          const el = icon.shadowRoot!.querySelector('canvas')!;
          const pixels = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data;
          let selected = 0;
          for (let i = 0; i < pixels.length; i += 4)
            if (pixels[i] === 179 && pixels[i + 1] === 212 && pixels[i + 2] === 252) selected++;
          const r = field.getBoundingClientRect(),
            host = icon.getBoundingClientRect();
          return { selected, offset: r.x - host.x, width: r.width };
        });
        expect(canvas.selected).toBeGreaterThan(0);
        expect(canvas.offset).toBeCloseTo(0, 1);
        expect(canvas.width).toBeCloseTo(360, 1);
      } finally {
        await browser.close();
      }
    },
    30000,
  );
}
