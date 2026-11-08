import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import { testFont } from '../../../../tools/test-font.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../core/index.ts';
for (const [name, engine, path] of [
  [
    'Chromium',
    chromium,
    '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['Firefox', firefox, '.cache/ms-playwright/firefox-1555/firefox/firefox'],
] as const)
  for (const renderer of ['svg', 'canvas']) {
    it.skipIf(!existsSync(resolve(homedir(), path)))(
      `${name} ${renderer}: reflow hugs live text, retargets continuously, wraps fill text, and snaps for reduced motion`,
      async () => {
        const browser = await engine.launch({
          executablePath: resolve(homedir(), path),
          headless: true,
        });
        try {
          const page = await browser.newPage();
          await page.setContent(
            `<anima-icon renderer="${renderer}" style="width:240px;height:240px" paused></anima-icon>`,
          );
          await page.evaluate(async (base64) => {
            const face = await new FontFace(
              'Anima Test',
              Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
            ).load();
            document.fonts.add(face);
            await document.fonts.ready;
          }, testFont().toString('base64'));
          for (const entry of [
            'index',
            'text',
            'text-canvas',
            'data',
            'bind',
            'layout',
            'layout-reflow',
            'canvas',
          ])
            await page.addScriptTag({
              type: 'module',
              content: await cachedBundle(resolve('packages/web/src/' + entry + '.ts')),
            });
          await page.waitForFunction(
            () => !!(customElements.get('anima-icon') as typeof AnimaIcon).modules.get('layout'),
          );
          const r = await page.evaluate(async (renderer) => {
            const icon = document.querySelector('anima-icon')!;
            const wait = () =>
              new Promise<void>((r) =>
                requestAnimationFrame(() => requestAnimationFrame(() => r())),
              );
            const doc = {
              anima: '0.1',
              name: 'reflow-button',
              grid: 20,
              requires: ['layout', 'text', 'data', 'bind'],
              data: {
                models: { Main: { properties: { label: { type: 'string', default: 'Go' } } } },
              },
              nodes: [
                {
                  id: 'button',
                  type: 'layout',
                  x: 2,
                  y: 2,
                  padding: [1, 2],
                  reflow: '1 linear',
                  fill: { color: '#d97757' },
                  children: [
                    {
                      id: 'label',
                      type: 'text',
                      layout: { width: 'hug' },
                      runs: [{ text: '$label', style: 'body' }],
                      styles: { body: { font: 'Anima Test', size: 2 } },
                    },
                  ],
                },
              ],
            };
            const load = async (doc: object) => {
              const ready = new Promise<void>((r, j) => {
                icon.addEventListener('anima:load', () => r(), { once: true });
                icon.addEventListener(
                  'anima:error',
                  (e) => j(Error(JSON.stringify((e as CustomEvent).detail))),
                  { once: true },
                );
              });
              icon.load(doc);
              await ready;
              await wait();
            };
            await load(doc);
            const p = icon.player!;
            const width = () => p.drawnLayoutBox('button')!.width;
            const paint = async () => {
              icon.invalidate();
              await wait();
              if (renderer === 'svg')
                return +icon.shadowRoot!.querySelector('rect')!.getAttribute('width')!;
              const c = icon.shadowRoot!.querySelector('canvas')!;
              return [...c.getContext('2d')!.getImageData(120, 30, 1, 1).data];
            };
            const start = width();
            p.set('$label', 'Longer');
            const waking = p.step(0).settled;
            const target = p.layoutBox('button')!.width;
            const busy = p.busy;
            const first = width();
            p.step(0.5);
            const middle = width(),
              painted = await paint();
            p.set('$label', 'Go');
            p.step(0.25);
            const retarget = width();
            p.step(0.5);
            const returning = width();
            p.reducedMotion = true;
            const settled = p.step(0).settled,
              snap = width();
            p.reducedMotion = false;
            p.set('$label', 'Longer');
            p.step(0);
            icon.play();
            await new Promise<void>((resolve) => {
              const check = () => (p.busy ? requestAnimationFrame(check) : resolve());
              requestAnimationFrame(check);
            });
            const playback = icon.playback;
            icon.pause();
            await load({
              anima: '0.1',
              name: 'wrap',
              grid: 20,
              requires: ['layout', 'text'],
              nodes: [
                {
                  id: 'root',
                  type: 'layout',
                  width: 8,
                  padding: 1,
                  direction: 'column',
                  children: [
                    {
                      id: 'text',
                      type: 'text',
                      layout: { width: 'fill' },
                      wrap: true,
                      runs: [{ text: 'Go Go Go Go', style: 'body' }],
                      styles: { body: { font: 'Anima Test', size: 2 } },
                    },
                  ],
                },
              ],
            });
            const wrap = icon.player!.layoutBox('text')!,
              root = icon.player!.layoutBox('root')!;
            const invalid = icon.load({
              anima: '0.1',
              name: 'bad-reflow',
              grid: 20,
              requires: ['layout'],
              nodes: [{ id: 'root', type: 'layout', reflow: '-1 out', children: [] }],
            });
            return {
              playback,
              invalid,
              start,
              target,
              first,
              middle,
              retarget,
              returning,
              waking,
              busy,
              painted,
              snap,
              settled,
              wrap,
              root,
            };
          }, renderer);
          expect(r.start).toBeCloseTo(6.4, 1);
          expect(r.target).toBeCloseTo(11.2, 1);
          expect(r.first).toBe(r.start);
          expect(r.middle).toBeCloseTo((r.start + r.target) / 2);
          expect(r.retarget).toBeCloseTo(r.start + (r.target - r.start) * 0.75);
          expect(r.returning).toBeCloseTo((r.retarget + r.start) / 2);
          expect(r.playback).toBe('settled');
          expect(r.invalid).toContainEqual(
            expect.objectContaining({ code: 'layout-reflow', pointer: '/nodes/0/reflow' }),
          );
          expect(r.waking).toBe(false);
          expect(r.busy).toBe(true);
          expect(r.settled).toBe(true);
          expect(r.snap).toBeCloseTo(r.start);
          if (renderer === 'svg') expect(r.painted).toBeCloseTo(r.middle);
          else expect(r.painted).toEqual([217, 119, 87, 255]);
          expect(r.wrap.width).toBe(6);
          expect(r.wrap.height).toBeGreaterThan(2);
          expect(r.root.height).toBeCloseTo(r.wrap.height + 2);
        } finally {
          await browser.close();
        }
      },
      45_000,
    );
  }
