// Rottweiler P6 regressions (design/rottweiler/P6-LEDGER.md).
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../web/index.ts';
const bundles = await Promise.all(
  ['input', 'assets'].map((name) => cachedBundle(resolve('packages/web/src/' + name + '.ts'))),
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
] as const)
  it.skipIf(!existsSync(executablePath))(
    `${name}: R2-02 asset-backed loads attach DOM input; R2-05 disabled listeners block Enter activation`,
    async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent('<anima-icon style="width:200px;height:200px"></anima-icon>');
        for (const content of bundles) await page.addScriptTag({ type: 'module', content });
        await page.waitForFunction(() =>
          ['input', 'assets'].every((n) =>
            (customElements.get('anima-icon') as typeof AnimaIcon).modules.has(n),
          ),
        );
        const result = await page.evaluate(async () => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const key = (key: string) => {
            icon.dispatchEvent(
              new KeyboardEvent('keydown', { key, bubbles: true, composed: true }),
            );
            icon.player!.step(0);
          };
          const base = {
            anima: '0.1',
            name: 'input',
            grid: 20,
            inputs: { go: { type: 'bool', default: false } },
            nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 9 }],
          };
          await new Promise<void>((res) => {
            icon.addEventListener('anima:load', () => res(), { once: true });
            icon.load({
              ...base,
              requires: ['input', 'assets'],
              assets: {},
              listeners: [{ on: 'key-down', key: 'x', set: { go: true } }],
            });
          });
          key('x');
          const asyncKey = icon.get('go');
          icon.load({
            ...base,
            requires: ['input'],
            a11y: { role: 'button', label: 'go', activate: 'go' },
            listeners: [{ on: 'down', target: 'dot', set: { go: true } }],
          });
          icon.inputOptions = { listeners: false };
          key('Enter');
          const disabledEnter = icon.get('go');
          icon.inputOptions = { listeners: true };
          key('Enter');
          return { asyncKey, disabledEnter, enabledEnter: icon.get('go') };
        });
        expect(result).toEqual({ asyncKey: true, disabledEnter: false, enabledEnter: true });
      } finally {
        await browser.close();
      }
    },
    30000,
  );
