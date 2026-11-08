// Browser regressions for P4 Rottweiler review findings (design/rottweiler/P4-LEDGER.md).
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type Page } from 'playwright-core';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type {} from '../../web/index.ts';
const root = new URL('../../../../', import.meta.url);
const doc = {
  anima: '0.1',
  name: 'focus',
  grid: 20,
  requires: ['focus'],
  inputs: { go: { type: 'trigger' } },
  nodes: [
    { id: 'r', type: 'rect', x0: 0, y0: 0, w: 10, h: 10, fill: { color: '#000' }, focus: {} },
  ],
  machine: {
    layers: {
      l: {
        initial: 'a',
        states: {
          a: { pose: { 'r.w': 10 }, on: [{ when: 'go', to: 'b' }] },
          b: { pose: { 'r.w': 5 } },
        },
      },
    },
  },
};
for (const [name, engine, executablePath] of [
  [
    'Chromium',
    chromium,
    process.env.CHROMIUM_PATH ??
      resolve(
        homedir(),
        '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
      ),
  ],
  [
    'Firefox',
    firefox,
    process.env.FIREFOX_PATH ??
      resolve(homedir(), '.cache/ms-playwright/firefox-1555/firefox/firefox'),
  ],
] as const)
  describe.skipIf(!existsSync(executablePath))(
    `focus P4 review ${name}`,
    { timeout: 30000 },
    () => {
      let browser: Browser, page: Page, scripts: string[];
      beforeAll(async () => {
        scripts = await Promise.all(
          ['index', 'focus'].map((n) => bundle(new URL(`packages/web/src/${n}.ts`, root).pathname)),
        );
        browser = await engine.launch({
          executablePath,
          headless: true,
          args: name === 'Chromium' ? ['--no-sandbox'] : [],
        });
      }, 30000);
      afterAll(async () => browser?.close());
      beforeEach(async () => {
        page = await browser.newPage();
        await page.setContent(
          '<anima-icon motion="full" style="display:block;width:100px;height:100px"></anima-icon>',
        );
        for (const s of scripts) await page.addScriptTag({ type: 'module', content: s });
        await page.waitForFunction(() => !!document.querySelector('anima-icon')!.focusNext);
      });
      afterEach(async () => page.close());
      it('R4-03: a state change keeps the focus group exposed to assistive technology', async () => {
        const r = await page.evaluate(async (d) => {
          const i = document.querySelector('anima-icon')!;
          i.load(d);
          await i.ready;
          const before = [i.getAttribute('role'), i.getAttribute('aria-hidden')];
          const changed = new Promise((res) =>
            i.addEventListener('anima:state', res, { once: true }),
          );
          i.fire('go');
          i.pause();
          i.play();
          await changed;
          return { before, after: [i.getAttribute('role'), i.getAttribute('aria-hidden')] };
        }, doc);
        expect(r).toEqual({ before: ['group', null], after: ['group', null] });
      });
      it('R5-02: a reload does not apply focus ownership to the next document', async () => {
        const r = await page.evaluate(async (d) => {
          const i = document.querySelector('anima-icon')!;
          const tick = () => new Promise((res) => setTimeout(res, 0));
          i.load(d);
          await i.ready;
          i.load({ ...d, a11y: { role: 'button', label: 'Go' } });
          await i.ready;
          await tick();
          const button = i.getAttribute('role');
          i.load(d);
          await i.ready;
          i.load({ ...d, nodes: [{ id: 'r', type: 'rect', x0: 0, y0: 0, w: 10, h: 10 }] });
          await i.ready;
          await tick();
          return { button, plain: [i.getAttribute('role'), i.getAttribute('aria-hidden')] };
        }, doc);
        expect(r).toEqual({ button: 'button', plain: [null, 'true'] });
      });
      it('R5-03: host label changes keep the focus group exposed', async () => {
        const r = await page.evaluate(async (d) => {
          const i = document.querySelector('anima-icon')!;
          const tick = () => new Promise((res) => setTimeout(res, 0));
          i.load(d);
          await i.ready;
          i.setAttribute('label', 'Volume');
          await tick();
          const labelled = [i.getAttribute('role'), i.getAttribute('aria-label')];
          i.removeAttribute('label');
          await tick();
          return { labelled, unlabelled: [i.getAttribute('role'), i.getAttribute('aria-hidden')] };
        }, doc);
        expect(r).toEqual({ labelled: ['group', 'Volume'], unlabelled: ['group', null] });
      });
    },
  );
