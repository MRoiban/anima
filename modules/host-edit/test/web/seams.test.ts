import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { describe, it, expect } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type { lists } from '../../../lists/core/index.ts';
import type {} from '../../web/index.ts';
import { repeatDocument, repeatContract, repeatExpected } from '../contracts.ts';

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
  describe(name + ' host seams', () => {
    it('retains repeat animation through icon.data, and shares source parsing/decode with isolated images', async () => {
      if (!existsSync(executablePath)) throw Error('browser absent');
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.setContent('<base href="http://anima.test/">');
        for (const entry of [
          'index',
          'host-edit',
          'host',
          'data',
          'bind',
          'assets',
          'paint',
          'components',
          'lists',
          'markup',
        ])
          await page.addScriptTag({
            type: 'module',
            content: await cachedBundle(
              resolve('packages/web/src/' + (entry === 'markup' ? 'markup-hooks' : entry) + '.ts'),
            ),
          });
        await page.waitForFunction(
          () => (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('lists'),
          {},
          { polling: 10 },
        );
        const repeated = await page.evaluate(
          async ({ doc, run }) => {
            const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
            const icon = document.createElement('anima-icon');
            icon.setAttribute('paused', '');
            document.body.append(icon);
            expectNoDiagnostics(icon.load(doc));
            await icon.ready;
            const active = Icon.modules.get('lists') as typeof lists;
            const contract = new Function('return (' + run + ')')() as typeof repeatContract;
            const result = contract(icon.player!, icon.data, () =>
              active.listState(icon.player!)!.runs[0]!.items.map((i) => i.player),
            );
            icon.destroy();
            return result;
            function expectNoDiagnostics(d: unknown[]) {
              if (d.length) throw Error(JSON.stringify(d));
            }
          },
          { doc: repeatDocument(), run: repeatContract.toString() },
        );
        expect(repeated).toEqual(repeatExpected);
        let fetches = 0;
        await page.route('http://anima.test/shared.animl', async (route) => {
          fetches++;
          await route.fulfill({
            contentType: 'application/xml',
            body: `<anima version="0.1" name="cached" grid="20" requires="data assets paint"><asset name="photo" type="image" src="photo.png"/><model name="Root"><number name="n" default="3"/><asset-ref name="picture" type="image" default="photo"/></model><image id="pic" asset="photo" x0="0" y0="0" width="10" height="10"/></anima>`,
          });
        });
        const cached = await page.evaluate(async () => {
          const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
          let parses = 0,
            decodes = 0,
            resolves = 0;
          const compile = Icon.compilerAsync!;
          Icon.compilerAsync = (...args) => {
            parses++;
            return compile(...args);
          };
          const decode = HTMLImageElement.prototype.decode;
          HTMLImageElement.prototype.decode = function () {
            decodes++;
            return decode.call(this);
          };
          const png = (color: string) => {
            const c = document.createElement('canvas');
            c.width = c.height = 1;
            const ctx = c.getContext('2d')!;
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 1, 1);
            return c.toDataURL();
          };
          const red = png('red'),
            blue = png('blue');
          const resolver: AnimaIcon['assets'] = () => {
            resolves++;
            return red;
          };
          const make = (
            assets: AnimaIcon['assets'] = resolver,
            policy: 'local' | 'any' = 'local',
          ) => {
            const icon = document.createElement('anima-icon');
            icon.assets = assets;
            icon.assetPolicy = policy;
            icon.setAttribute('auto-bind', '');
            icon.setAttribute('paused', '');
            document.body.append(icon);
            icon.setAttribute('src', 'shared.animl');
            return icon;
          };
          const a = make(),
            b = make();
          await Promise.all([a.ready, b.ready]).catch((d) => {
            throw Error(JSON.stringify(d));
          });
          const initial = {
            parses,
            decodes,
            resolves,
            sameModel: a.player!.model === b.player!.model,
          };
          a.data.number('n').set(9);
          a.player!.step(0);
          await a.data.image('picture').set(blue);
          a.player!.step(0);
          a.invalidate();
          b.invalidate();
          const independent = [
            a.data.number('n').value,
            b.data.number('n').value,
            a.shadowRoot!.querySelector('image')!.getAttribute('href') === blue,
            b.shadowRoot!.querySelector('image')!.getAttribute('href') === red,
          ];
          const c = make(resolver, 'any');
          await c.ready;
          const d = make(() => blue);
          await d.ready;
          const isolatedKeys = { parses, decodes, resolves };
          b.invalidate();
          const contextColors = [
            c.shadowRoot!.querySelector('image')!.getAttribute('href') === red,
            d.shadowRoot!.querySelector('image')!.getAttribute('href') === blue,
            b.shadowRoot!.querySelector('image')!.getAttribute('href') === red,
          ];
          // Supported compiled-model instantiation starts fresh player state, with no parsing.
          const e = document.createElement('anima-icon');
          e.assets = resolver;
          e.setAttribute('paused', '');
          document.body.append(e);
          e.load(a.player!.model);
          await e.ready;
          e.data.bind('default');
          const compiledValue = e.data.number('n').value;
          for (const icon of [a, b, c, d, e]) icon.destroy();
          Icon.compilerAsync = compile;
          HTMLImageElement.prototype.decode = decode;
          return { initial, independent, isolatedKeys, compiledValue, contextColors };
        });
        expect(cached).toEqual({
          initial: { parses: 1, decodes: 1, resolves: 1, sameModel: true },
          independent: [9, 3, true, true],
          isolatedKeys: { parses: 1, decodes: 4, resolves: 2 },
          compiledValue: 3,
          contextColors: [true, true, true],
        });
        expect(fetches).toBe(1);
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    }, 30000);
  });
