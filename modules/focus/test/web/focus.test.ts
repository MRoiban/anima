import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type Page } from 'playwright-core';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../core/index.ts';
declare global {
  interface Window {
    focusIcon: AnimaIcon;
  }
}
const root = new URL('../../../../', import.meta.url);
const doc = {
  anima: '0.1',
  name: 'focus',
  grid: 20,
  requires: ['focus'],
  nodes: [
    {
      id: 'a',
      type: 'circle',
      center: [2, 2],
      r: 1,
      fill: { color: '#000' },
      focus: { label: 'First', bounds: [1, 1, 2, 2] },
    },
    {
      id: 'b',
      type: 'circle',
      center: [8, 2],
      r: 1,
      fill: { color: '#000' },
      focus: { label: 'Second', bounds: [7, 1, 2, 2] },
    },
  ],
  inputs: { on: { type: 'bool', default: false } },
  a11y: { role: 'button', label: 'Test', activate: 'on' },
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
  describe.skipIf(!existsSync(executablePath))(`focus ${name}`, () => {
    let browser: Browser, page: Page, base: string, focus: string;
    beforeAll(async () => {
      [base, focus] = await Promise.all(
        ['index', 'focus'].map((n) => bundle(new URL(`packages/web/src/${n}.ts`, root).pathname)),
      );
      browser = await engine.launch({
        executablePath,
        headless: true,
        args: name === 'Chromium' ? ['--no-sandbox'] : [],
      });
    }, 30000);
    afterAll(async () => {
      await browser?.close();
    });
    beforeEach(async () => {
      page = await browser.newPage();
      await page.setContent(
        '<button id="before">Before</button><anima-icon style="width:100px;height:100px"></anima-icon><button id="after">After</button>',
      );
      await page.addScriptTag({ type: 'module', content: base });
      await page.waitForFunction(() => !!customElements.get('anima-icon'));
      await page.addScriptTag({ type: 'module', content: focus });
      await page.waitForFunction(() =>
        document.querySelector('anima-icon')!.hasAttribute('data-focus-ready'),
      );
      await page.evaluate((d) => {
        window.focusIcon = document.querySelector('anima-icon')!;
        window.focusIcon.load(d);
      }, doc);
    });
    afterEach(async () => {
      await page.close();
    });
    const active = () =>
      page.evaluate(() => window.focusIcon.shadowRoot?.activeElement?.getAttribute('data-focus'));
    it('one Tab stop, arrows, forward exit and reverse entry/exit', async () => {
      await page.locator('#before').focus();
      await page.keyboard.press('Tab');
      expect(await active()).toBe('a');
      await page.keyboard.press('ArrowRight');
      expect(await active()).toBe('b');
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.id)).toBe('after');
      await page.keyboard.press('Shift+Tab');
      expect(await active()).toBe('a');
      await page.keyboard.press('Shift+Tab');
      expect(await page.evaluate(() => document.activeElement?.id)).toBe('before');
    });
    it('opt-in native inner Tab stops in both directions', async () => {
      await page.evaluate((d) => {
        (d.nodes[0].focus as Record<string, unknown>).tabStops = true;
        window.focusIcon.load(d);
      }, doc);
      await page.locator('#before').focus();
      await page.keyboard.press('Tab');
      expect(await active()).toBe('a');
      await page.keyboard.press('Tab');
      expect(await active()).toBe('b');
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.id)).toBe('after');
      await page.keyboard.press('Shift+Tab');
      expect(await active()).toBe('b');
      await page.keyboard.press('Shift+Tab');
      expect(await active()).toBe('a');
    });
    it('pointer focus is real DOM focus', async () => {
      await page.locator('anima-icon').click({ position: { x: 40, y: 10 } });
      expect(await active()).toBe('b');
    });
    it('focuses component internals through dotted paths', async () => {
      const code = await bundle(new URL('packages/web/src/components.ts', root).pathname);
      await page.addScriptTag({ type: 'module', content: code });
      await page.waitForTimeout(50);
      await page.evaluate((d) => {
        window.focusIcon.load({
          anima: '0.1',
          name: 'nested',
          grid: 20,
          requires: ['focus', 'components'],
          components: { child: { grid: 20, nodes: d.nodes } },
          nodes: [{ id: 'child', type: 'instance', component: 'child' }],
        });
      }, doc);
      await page.locator('#before').focus();
      await page.keyboard.press('Tab');
      expect(await active()).toBe('child.a');
      await page.keyboard.press('ArrowRight');
      expect(await active()).toBe('child.b');
    });
    it('preserves host Enter and Space activation', async () => {
      await page.locator('#before').focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await expect.poll(() => page.evaluate(() => window.focusIcon.get('on'))).toBe(true);
      await page.keyboard.down('Space');
      expect(await page.evaluate(() => window.focusIcon.get('on'))).toBe(true);
      await page.keyboard.up('Space');
      await expect.poll(() => page.evaluate(() => window.focusIcon.get('on'))).toBe(false);
    });
  });
