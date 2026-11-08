import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../core/index.ts';

// Rottweiler P3 R1-01 / R1-02: the focus bridge survives renderer rebuilds and repeat growth, and
// `loadModel()` installs it on a fresh host.
for (const [name, engine, cache] of [
  [
    'Chromium',
    chromium,
    '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['Firefox', firefox, '.cache/ms-playwright/firefox-1555/firefox/firefox'],
] as const) {
  const executablePath = resolve(homedir(), cache);
  describe.skipIf(!existsSync(executablePath))(name + ' focus bridge (Rottweiler P3)', () => {
    const open = async (entries: string[]) => {
      const browser = await engine.launch({ executablePath, headless: true });
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setContent(
        '<anima-icon paused style="display:block;width:100px;height:100px"></anima-icon>',
      );
      for (const n of ['index', ...entries])
        await page.addScriptTag({
          type: 'module',
          content: await bundle(resolve(`packages/web/src/${n}.ts`)),
        });
      await page.waitForFunction(
        (names) =>
          names.every((n) =>
            (customElements.get('anima-icon') as typeof AnimaIcon | undefined)?.modules.has(n),
          ),
        entries,
      );
      return { browser, page, errors };
    };
    it('keeps DOM focus targets when a repeat grows', async () => {
      const { browser, page, errors } = await open(['focus', 'data', 'components', 'lists']);
      try {
        const result = await page.evaluate(() => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          icon.load({
            anima: '0.1',
            name: 'repeatfocus',
            grid: 20,
            requires: ['components', 'data', 'lists', 'focus'],
            data: {
              models: { M: { properties: { n: { type: 'number', default: 1 } } } },
              instances: { main: { model: 'M', default: true } },
            },
            components: {
              row: {
                grid: 20,
                nodes: [
                  {
                    id: 'target',
                    type: 'circle',
                    r: 1,
                    center: [2, 2],
                    fill: { color: '#000' },
                    focus: { label: 'Target', tabStops: true },
                  },
                ],
              },
            },
            nodes: [
              {
                id: 'rows',
                type: 'repeat',
                component: 'row',
                count: '$n',
                dx: 5,
                focus: { enabled: false, edge: 'parent-scope' },
              },
            ],
          });
          icon.player!.step(0);
          const dom = () =>
            [...icon.shadowRoot!.querySelectorAll<HTMLElement>('[data-focus]')].map(
              (n) => n.dataset.focus,
            );
          icon.set('$n', 2);
          icon.play();
          const grown = dom();
          icon.player!.focusTarget('rows.1.target');
          const active = (icon.shadowRoot!.activeElement as HTMLElement | null)?.dataset.focus;
          icon.setAttribute('renderer', 'svg');
          icon.removeAttribute('renderer');
          return { grown, active, rebuilt: dom() };
        });
        expect(result.grown).toContain('rows.1.target');
        expect(result.active).toBe('rows.1.target');
        expect(result.rebuilt).toContain('rows.1.target');
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    }, 30_000);
    it('creates DOM focus targets when a repeat grows from zero rows', async () => {
      const { browser, page, errors } = await open(['focus', 'data', 'components', 'lists']);
      try {
        const result = await page.evaluate(() => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          icon.load({
            anima: '0.1',
            name: 'empty',
            grid: 20,
            requires: ['focus', 'components', 'data', 'lists'],
            data: {
              models: { M: { properties: { n: { type: 'number', default: 0 } } } },
              instances: { main: { model: 'M', default: true } },
            },
            components: {
              row: {
                grid: 20,
                nodes: [
                  {
                    id: 'target',
                    type: 'circle',
                    r: 1,
                    center: [2, 2],
                    fill: { color: '#000' },
                    focus: { tabStops: true },
                  },
                ],
              },
            },
            nodes: [{ id: 'rows', type: 'repeat', component: 'row', count: '$n', dx: 5 }],
          });
          icon.player!.step(0);
          const dom = () => icon.shadowRoot!.querySelectorAll('[data-focus]').length;
          const before = dom();
          icon.set('$n', 1);
          icon.play();
          icon.pause();
          const after = dom();
          icon.focusNext();
          const active = (icon.shadowRoot!.activeElement as HTMLElement | null)?.dataset.focus;
          return { before, after, active };
        });
        expect(result).toEqual({ before: 0, after: 1, active: 'rows.0.target' });
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    }, 30_000);
    it('installs the bridge through loadModel() on a fresh host', async () => {
      const { browser, page, errors } = await open(['focus']);
      try {
        const result = await page.evaluate(() => {
          const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
          const icon = document.createElement('anima-icon') as AnimaIcon;
          icon.setAttribute('paused', '');
          document.body.append(icon);
          const { model } = Icon.compile({
            anima: '0.1',
            name: 'focus',
            grid: 20,
            requires: ['focus'],
            nodes: [
              {
                type: 'circle',
                id: 'a',
                center: [2, 2],
                r: 1,
                fill: { color: '#000' },
                focus: { label: 'A' },
              },
            ],
          });
          icon.loadModel(model!);
          const tabIndex = icon.tabIndex;
          icon.focusNext();
          return {
            ready: icon.hasAttribute('data-focus-ready'),
            tabIndex,
            hidden: icon.getAttribute('aria-hidden'),
            active: (icon.shadowRoot!.activeElement as HTMLElement | null)?.dataset.focus,
          };
        });
        expect(result).toEqual({ ready: true, tabIndex: 0, hidden: null, active: 'a' });
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    }, 30_000);
  });
}
