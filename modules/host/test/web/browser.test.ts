import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { describe, it, expect } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../web/index.ts';
for (const [name, engine, paths] of [
  [
    'Chromium',
    chromium,
    [
      process.env.CHROMIUM_PATH,
      resolve(
        homedir(),
        '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
      ),
      chromium.executablePath(),
    ],
  ],
  [
    'Firefox',
    firefox,
    [
      process.env.FIREFOX_PATH,
      resolve(homedir(), '.cache/ms-playwright/firefox-1555/firefox/firefox'),
      firefox.executablePath(),
    ],
  ],
] as const)
  describe(name + ' host', () => {
    for (const first of [true, false])
      it(
        'separate bundles; host first=' + first,
        async () => {
          const executablePath = paths.find((p) => p && existsSync(p));
          if (!executablePath) throw Error('browser absent');
          const browser = await engine.launch({ executablePath, headless: true });
          try {
            const page = await browser.newPage();
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(e.message));
            await page.setContent(
              '<anima-icon auto-bind style="display:block;width:100px;height:100px"></anima-icon><anima-icon id="manual" paused auto-bind></anima-icon>',
            );
            const earlyDoc = {
              anima: '0.1',
              name: 'early',
              grid: 20,
              requires: ['data'],
              nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
              data: {
                models: { Score: { properties: { score: { type: 'number', default: 4 } } } },
              },
            };
            await page.evaluate((doc) => {
              const early = document.createElement('anima-icon');
              early.id = 'early';
              early.setAttribute('auto-bind', '');
              const script = document.createElement('script');
              script.type = 'application/vnd.anima+json';
              script.textContent = JSON.stringify(doc);
              early.append(script);
              document.body.append(early);
            }, earlyDoc);
            for (const mod of [
              'index',
              ...(first ? ['host', 'data', 'bind', 'markup'] : ['markup', 'bind', 'data', 'host']),
            ]) {
              if (mod === 'host' && !first)
                await page.waitForFunction(
                  () => !!(document.querySelector('#early') as AnimaIcon).player,
                );
              await page.addScriptTag({
                type: 'module',
                content: await bundle(resolve('packages/web/src/' + mod + '.ts')),
              });
            }
            await page.waitForFunction(() => {
              const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
              return !!Icon?.compiler && ['data', 'host'].every((m) => Icon.modules.has(m));
            });
            const result = await page.evaluate(async () => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              const manual = document.querySelector('#manual') as AnimaIcon;
              let emptyCode = '';
              try {
                void icon.data;
              } catch (e) {
                emptyCode = (e as { code: string }).code;
              }
              const early = document.querySelector('#early') as AnimaIcon;
              const earlyValue = early.data.get('$score');
              const earlyChanges: number[] = [];
              early.data.number('$score').on('change', (v) => earlyChanges.push(v));
              early.data.number('$score').set(8);
              early.player!.step(0);
              const xml = `<anima version="0.1" name="host-browser" grid="20" requires="data"><model name="Score"><number name="score" default="4"/><string name="label" default="Ada"/><trigger name="pulse"/><enum name="mood" values="calm happy"/><list name="items" of="Item"/></model><model name="Item"><number name="count" default="3"/></model><instance name="main" model="Score" default="true"/><circle id="dot" cx="10" cy="10" r="1" fill="#000"/><bind target="dot.r" value="$score"/></anima>`;
              const doc = (customElements.get('anima-icon') as typeof AnimaIcon).compiler!(xml);
              if (!doc.doc) throw Error(JSON.stringify(doc.diagnostics));
              const loaded = () =>
                new Promise<void>((resolve) =>
                  icon.addEventListener('anima:load', () => resolve(), { once: true }),
                );
              let load = loaded();
              icon.load(doc.doc);
              await load;
              const old = icon.data;
              const score = icon.data.number('$score');
              const deliveries: unknown[] = [];
              const off = score.on('change', (v) =>
                deliveries.push([v, icon.data.get('$label'), icon.player!.value('dot.r')]),
              );
              const changed = new Promise<void>((resolve) => {
                const cancel = score.on('change', () => {
                  cancel();
                  resolve();
                });
              });
              icon.data.batch(() => {
                score.set(5);
                score.set(9);
                icon.data.string('$label').set('Grace');
              });
              await changed;
              const after = {
                value: score.value,
                r: icon.shadowRoot!.querySelector('circle')!.getAttribute('r'),
              };
              off();
              off();
              const callbackSequence: number[] = [];
              let stop: () => void;
              const next = new Promise<void>((resolve) => {
                stop = score.on('change', (value) => {
                  callbackSequence.push(value);
                  if (value === 8) score.set(11);
                  if (value === 11) resolve();
                });
              });
              score.set(8);
              await next;
              stop!();
              const created = icon.data.create('Score', { score: 12 });
              icon.data.bind(created);
              icon.player!.step(0);
              const createdValue = icon.data.get('$score');
              const events: unknown[] = [];
              const trigger = icon.data.trigger('$main:pulse');
              trigger.on('change', (v) => events.push(v));
              trigger.fire();
              icon.player!.step(0);
              let code = '';
              try {
                icon.data.string('$score');
              } catch (e) {
                code = (e as { code: string }).code;
              }
              icon.data.list('$items').set([{ count: 8 }]);
              icon.player!.step(0);
              const listValue = icon.data.number('$items.0.count').value;
              // Paused loads must auto-bind before load callbacks, even without a scheduled step.
              manual.load(doc.doc);
              const paused = manual.data.get('$score');
              manual.removeAttribute('auto-bind');
              manual.load(doc.doc);
              let unbound = '';
              try {
                manual.data.get('$score');
              } catch (e) {
                unbound = (e as { code: string }).code;
              }
              manual.data.bind(manual.data.instances()[0]!);
              const explicit = manual.data.number('$score').value;
              load = loaded();
              icon.load(doc.doc);
              await load;
              const fresh = old !== icon.data;
              const reflected = icon.data
                .models()[0]!
                .properties.find((p) => p.name === 'mood')!.values;
              const reset = icon.data.get('$score');
              icon.destroy();
              manual.destroy();
              early.destroy();
              return {
                deliveries,
                callbackSequence,
                earlyValue,
                emptyCode,
                earlyChanges,
                after,
                createdValue,
                events,
                code,
                listValue,
                paused,
                unbound,
                explicit,
                fresh,
                reflected,
                reset,
              };
            });
            expect(result).toEqual({
              deliveries: [[9, 'Grace', 9]],
              callbackSequence: [8, 11],
              earlyValue: 4,
              emptyCode: 'data-instance',
              earlyChanges: [8],
              after: { value: 9, r: '9' },
              createdValue: 12,
              events: [undefined],
              code: 'data-type',
              listValue: 8,
              paused: 4,
              unbound: 'data-instance',
              explicit: 4,
              fresh: true,
              reflected: ['calm', 'happy'],
              reset: 4,
            });
            expect(errors).toEqual([]);
          } finally {
            await browser.close();
          }
        },
        30000,
      );
  });
