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
  name: 'input',
  grid: 20,
  requires: ['input'],
  inputs: { got: { type: 'bool' }, held: { type: 'bool' } },
  nodes: [{ id: 'disc', type: 'circle', center: [10, 10], r: 8, fill: { color: '#000' } }],
  listeners: [
    { on: 'key-down', key: 'a', set: { got: true } },
    { on: 'down', set: { held: true } },
    { on: 'cancel', set: { held: false } },
  ],
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
    `input P4 review ${name}`,
    { timeout: 30000 },
    () => {
      let browser: Browser, page: Page, scripts: string[];
      beforeAll(async () => {
        scripts = await Promise.all(
          ['index', 'input', 'assets'].map((n) =>
            bundle(new URL(`packages/web/src/${n}.ts`, root).pathname),
          ),
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
          '<anima-icon motion="full" style="display:block;width:200px;height:100px"></anima-icon>',
        );
        await page.addScriptTag({ type: 'module', content: scripts[0] });
        await page.waitForFunction(() => !!customElements.get('anima-icon'));
        for (const s of scripts.slice(1)) await page.addScriptTag({ type: 'module', content: s });
        await page.waitForFunction(() => !!document.querySelector('anima-icon')!.input);
      });
      afterEach(async () => page.close());
      it('R2-03: attaches DOM input after an asynchronous asset load', async () => {
        const got = await page.evaluate(async (d) => {
          const i = document.querySelector('anima-icon')!;
          i.load({ ...d, requires: ['input', 'assets'], assets: {} });
          await i.ready;
          i.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
          i.player!.step(0);
          return i.get('got');
        }, doc);
        expect(got).toBe(true);
      });
      it('R2-04: disconnecting cancels pressed contacts', async () => {
        const r = await page.evaluate((d) => {
          const i = document.querySelector('anima-icon')!;
          i.load(d);
          const b = i.getBoundingClientRect();
          i.dispatchEvent(
            new PointerEvent('pointerdown', {
              bubbles: true,
              pointerId: 7,
              clientX: b.x + b.width / 2,
              clientY: b.y + b.height / 2,
            }),
          );
          i.player!.step(0);
          const pressed = i.get('held');
          i.remove();
          document.body.append(i);
          i.player!.step(0);
          return { pressed, contacts: i.input().contacts.size, held: i.get('held') };
        }, doc);
        expect(r).toEqual({ pressed: true, contacts: 0, held: false });
      });
    },
  );
