import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser } from 'playwright-core';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../../host/web/index.ts';
import type {} from '../../web/index.ts';
for (const [name, engine, cache] of [
  [
    'Chromium',
    chromium,
    '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['Firefox', firefox, '.cache/ms-playwright/firefox-1555/firefox/firefox'],
] as const)
  describe(name + ' component values and data keyframes', () => {
    let browser: Browser;
    const entries = [
      'index',
      'components',
      'nested',
      'data',
      'motion',
      'host',
      'host-edit',
      'markup',
    ];
    const bundles = new Map<string, string>();
    beforeAll(async () => {
      await Promise.all(
        entries.map(async (entry) =>
          bundles.set(
            entry,
            await bundle(
              resolve('packages/web/src/' + (entry === 'markup' ? 'markup-hooks' : entry) + '.ts'),
            ),
          ),
        ),
      );
      const executablePath = [resolve(homedir(), cache), engine.executablePath()].find(existsSync);
      if (!executablePath) throw Error('browser absent');
      browser = await engine.launch({ executablePath, headless: true });
    });
    afterAll(async () => {
      await browser?.close();
    });
    for (const order of [entries, ['index', ...entries.slice(1).reverse()]])
      it(
        'keeps typed host changes and keyframes local across separately loaded bundles: ' +
          order.join(','),
        async () => {
          const page = await browser.newPage();
          try {
            await page.setContent(
              '<anima-icon auto-bind paused></anima-icon><anima-icon auto-bind paused></anima-icon>',
            );
            for (const entry of order)
              await page.addScriptTag({ type: 'module', content: bundles.get(entry)! });
            await page.waitForFunction(() =>
              (customElements.get('anima-icon') as typeof AnimaIcon)?.modules.has('nested'),
            );
            const result = await page.evaluate(async () => {
              const icons = [...document.querySelectorAll('anima-icon')] as AnimaIcon[];
              const source = `<anima version="0.1" name="host-card-keys" grid="20" requires="data components nested motion">
          <model name="Card"><component name="card" default="row"/><number name="peak" default="8"/></model>
          <component name="row" grid="10"><circle id="dot" cx="5" cy="5" r="2" fill="#000"/></component>
          <component name="box" grid="10"><rect id="rect" x0="0" y0="0" width="4" height="4" fill="#000"/></component>
          <instance id="badge" component="$card"/>
          <circle id="probe" cx="15" cy="15" r="1" fill="#000"/>
          <timeline name="rise" duration="1"><track target="probe.r"><key t="0" value="0"/><key t="1" value="$peak"/></track></timeline>
          <layer name="main" initial="run"><state name="run" play="rise"/></layer>
          <layer name="selection" initial="row"><state name="row"><pose probe.opacity="1"/><on when="$card == component(&quot;box&quot;)" to="box"/></state><state name="box"><pose probe.opacity="0.5"/></state></layer></anima>`;
              for (const icon of icons) {
                const ds = icon.load(source, true);
                if (ds.some((d) => d.severity === 'error')) throw Error(JSON.stringify(ds));
                icon.player!.step(0.25);
              }
              const [a, b] = icons as [AnimaIcon, AnimaIcon];
              const old = a.instance('badge'),
                delivered: string[] = [];
              const card = a.data!.component('card');
              card.on('change', (v) => delivered.push(v));
              a.data!.batch(() => {
                card.set('box');
                a.data!.number('peak').set(16);
              });
              const before = card.value;
              a.player!.step(0);
              b.player!.step(0);
              const changed = a.instance('badge') !== old;
              const raw = a.instance('badge').model.nodes[0]!.type;
              const values = icons.map((icon) => icon.player!.value('probe.r'));
              const opacity = icons.map((icon) => icon.player!.value('probe.opacity'));
              const retained = a.instance('badge');
              card.set('box');
              a.player!.step(0);
              // Retained handles read committed values; equal selections retain the child.
              const same = retained === a.instance('badge');
              await Promise.resolve();
              const other = b.data!.component('card').value;
              for (const icon of icons) icon.destroy();
              return { before, changed, raw, delivered, values, opacity, other, same };
            });
            expect(result).toEqual({
              before: 'row',
              changed: true,
              raw: 'rect',
              delivered: ['box'],
              values: [4, 2],
              opacity: [0.5, 1],
              other: 'row',
              same: true,
            });
          } finally {
            await page.close();
          }
        },
      );
  });
