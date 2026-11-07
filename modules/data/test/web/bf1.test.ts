import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser } from 'playwright-core';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../../host-edit/web/index.ts';
import { compile } from '../../../../packages/markup/src/index.ts';
import { scene } from '../fixtures/bf1/scene.ts';
for (const [name, engine, cache] of [
  [
    'Chromium',
    chromium,
    '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['Firefox', firefox, '.cache/ms-playwright/firefox-1555/firefox/firefox'],
] as const)
  describe(name + ' [BF-1]', () => {
    let browser: Browser;
    const entries = ['index', 'components', 'nested', 'data', 'bind', 'host', 'host-edit'];
    const bundles = new Map<string, string>();
    beforeAll(async () => {
      await Promise.all(
        entries.map(async (e) =>
          bundles.set(e, await cachedBundle(resolve(`packages/web/src/${e}.ts`))),
        ),
      );
      const executablePath = [resolve(homedir(), cache), engine.executablePath()].find(existsSync);
      if (!executablePath) throw Error('browser absent');
      browser = await engine.launch({ executablePath, headless: true });
    }, 120000);
    afterAll(async () => {
      await browser?.close();
    });
    it('updates retained SVG at every depth after hex/array, batched and document writes', async () => {
      const page = await browser.newPage();
      try {
        await page.setContent(
          '<anima-icon auto-bind style="width:100px;height:100px"></anima-icon>',
        );
        for (const entry of entries)
          await page.addScriptTag({ type: 'module', content: bundles.get(entry)! });
        await page.waitForFunction(
          () => (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('hostedit'),
          {},
          { polling: 10 },
        );
        const snapshots = await page.evaluate(async (doc) => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const ds = icon.load(doc);
          if (ds.some((d) => d.severity === 'error')) throw Error(JSON.stringify(ds));
          const read = () =>
            [...icon.shadowRoot!.querySelectorAll('circle')].map((e) => e.getAttribute('fill'));
          const wait = async (hex: string) => {
            for (let i = 0; i < 120 && read().some((v) => v !== hex); i++)
              await new Promise(requestAnimationFrame);
            return read();
          };
          const out = [await wait('#123456')];
          icon.data.color('$theme:ink').set('#abc');
          out.push(await wait('#aabbcc'));
          icon.data.batch(() => icon.data.color('$theme:ink').set([255, 0, 0, 255]));
          out.push(await wait('#ff0000'));
          icon.data.batch(() => icon.data.color('$theme:ink').set('#12345678'));
          out.push(await wait('#12345678'));
          icon.player!.pointer('down', 1, 1);
          icon.player!.pointer('up', 1, 1);
          icon.player!.onChange?.();
          out.push(await wait('#00ff00'));
          icon.player!.pointer('down', 5, 5);
          icon.player!.pointer('up', 5, 5);
          icon.player!.onChange?.();
          out.push(await wait('#abcdef'));
          let error;
          try {
            icon.data.color('$theme:ink').set('red');
          } catch (e) {
            const d = e as { code: string; pointer: string };
            error = { code: d.code, pointer: d.pointer };
          }
          icon.destroy();
          return { out, error };
        }, scene());
        expect(snapshots.out).toEqual(
          ['#123456', '#aabbcc', '#ff0000', '#12345678', '#00ff00', '#abcdef'].map((v) => [
            v,
            v,
            v,
          ]),
        );
        expect(snapshots.error).toEqual({ code: 'data-type', pointer: '/data/$theme:ink' });
      } finally {
        await page.close();
      }
    }, 30000);
    it.each(['control', 'ui:control', 'import-99-control'])(
      'selects the imported root by %s',
      async (component) => {
        const page = await browser.newPage();
        try {
          await page.setContent('<anima-icon auto-bind paused></anima-icon>');
          for (const entry of entries)
            await page.addScriptTag({ type: 'module', content: bundles.get(entry)! });
          await page.waitForFunction(
            () => (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('hostedit'),
            {},
            { polling: 10 },
          );
          const result = await page.evaluate(
            ({ doc, component }) => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              icon.setAttribute('component', component);
              const ds = icon.load(doc);
              if (ds.some((d) => d.severity === 'error')) return { ds };
              icon.data.color('$theme:ink').set('#fed');
              icon.player!.step(0);
              return {
                values: [
                  icon.player!.value('face.fill.color'),
                  icon.player!.value('digit/segment.fill.color'),
                ],
              };
            },
            { doc: scene(), component },
          );
          expect(result).toEqual({
            values: ['#ffeedd', '#ffeedd'],
          });
        } finally {
          await page.close();
        }
      },
      30000,
    );
    it('diagnoses an ambiguous root and accepts either qualified root', async () => {
      const library =
        '<library name="ui"><component name="switch" grid="10"><circle id="dot" cx="5" cy="5" r="1" fill="#123456"/></component></library>';
      const doc = compile(
        '<anima version="0.1" name="names" grid="10" requires="components"><import src="lib.animl" as="ui"/><import src="lib.animl" as="other"/><instance id="one" component="ui:switch"/></anima>',
        { resolve: () => library },
      ).doc!;
      const page = await browser.newPage();
      try {
        await page.setContent('<anima-icon paused></anima-icon>');
        for (const entry of entries)
          await page.addScriptTag({ type: 'module', content: bundles.get(entry)! });
        await page.waitForFunction(
          () => (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('hostedit'),
          {},
          { polling: 10 },
        );
        const results = await page.evaluate((doc) => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          return ['switch', 'ui:switch', 'other:switch'].map((name) => {
            icon.setAttribute('component', name);
            return icon.load(doc).filter((d) => d.severity === 'error');
          });
        }, doc);
        expect(results[0]).toContainEqual(
          expect.objectContaining({
            code: 'ambiguous-component',
            pointer: '/component', // host attribute: the root is chosen at instantiation (BF-3)
          }),
        );
        expect(results.slice(1)).toEqual([[], []]);
      } finally {
        await page.close();
      }
    }, 30000);
  });
