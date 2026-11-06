import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type Page } from 'playwright-core';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../core/api.ts';
declare global {
  interface Window {
    motionIcon: AnimaIcon;
    motionFrames: number;
  }
}
const root = new URL('../../../../', import.meta.url);
const doc = {
  anima: '0.1',
  name: 'test',
  grid: 20,
  requires: ['motion'],
  nodes: [{ id: 'a', type: 'circle', center: [10, 10], r: 1, fill: { color: '#000' } }],
  timelines: {
    t: {
      duration: 2,
      tracks: {
        'a.x': [
          [0, 0],
          [2, 20],
        ],
      },
      events: [[1, 'middle']],
    },
  },
  machines: { accent: { layers: { l: { initial: 's', states: { s: { pose: { 'a.y': 4 } } } } } } },
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
  describe.skipIf(!existsSync(executablePath))(`motion host in ${name}`, () => {
    let browser: Browser, page: Page, base: string, motion: string, markup: string;
    beforeAll(async () => {
      [base, motion, markup] = await Promise.all(
        ['index', 'motion', 'markup'].map((n) =>
          bundle(new URL(`packages/web/src/${n}.ts`, root).pathname),
        ),
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
        '<anima-icon motion="full" style="width:100px;height:100px"></anima-icon>',
      );
      await page.addScriptTag({ type: 'module', content: base });
      await page.waitForFunction(() => !!customElements.get('anima-icon'));
      await page.addScriptTag({ type: 'module', content: motion });
      await page.waitForFunction(
        () => typeof document.querySelector('anima-icon')!.timeline === 'function',
      );
      await page.evaluate((d) => {
        window.motionIcon = document.querySelector('anima-icon')!;
        window.motionIcon.load(d);
        window.motionIcon.pause();
      }, doc);
    });
    afterEach(async () => {
      await page.close();
    });
    it('exposes metadata, time, mix, typed nodes and independent animation advance/apply', async () => {
      const r = await page.evaluate(() => {
        const i = window.motionIcon,
          t = i.createTimeline('t', { name: 'manual', mix: 0.5 });
        t.advance(1);
        t.pause().apply();
        i.player!.step(0);
        i.invalidate();
        return {
          info: i.animations,
          time: t.time,
          value: i.values()['a.x'],
          node: i.node('a', 'circle')!.type,
          wrong: i.node('a', 'rect') === undefined,
        };
      });
      expect(r).toMatchObject({
        info: [{ name: 't', duration: 2, speed: 1, work: [0, 2], loop: 'once', quantize: null }],
        time: 1,
        value: 5,
        node: 'circle',
        wrong: true,
      });
    });
    it('seeks and scrubs without synthesizing events and repaints retained SVG', async () => {
      const r = await page.evaluate(() => {
        const i = window.motionIcon;
        i.seek('t', 1.5).pause();
        const a = i.player!.step(0);
        i.invalidate();
        const seek = i.values()['a.x'];
        i.scrub('t', 0.25);
        const b = i.player!.step(0);
        i.invalidate();
        return {
          seek,
          scrub: i.values()['a.x'],
          events: [...a.events, ...b.events],
          svg: i.shadowRoot!.querySelector('[transform]')!.getAttribute('transform'),
        };
      });
      expect(r.seek).toBe(15);
      expect(r.scrub).toBe(5);
      expect(r.events).toEqual([]);
      expect(r.svg).toContain('5');
    });
    it('plays, pauses, stops and overrides loops independently', async () => {
      const r = await page.evaluate(() => {
        const i = window.motionIcon,
          t = i.timeline('t');
        t.loop = 'loop';
        i.player!.step(2.5);
        const loop = i.values()['a.x'];
        t.pause();
        i.player!.step(1);
        const paused = i.values()['a.x'];
        t.play();
        t.speed = -1;
        i.player!.step(0.25);
        const reversed = i.values()['a.x'];
        t.stop();
        const stopped = i.player!.step(0);
        return { loop, paused, reversed, value: i.values()['a.x'], settled: stopped.settled };
      });
      expect(r).toEqual({ loop: 5, paused: 5, reversed: 2.5, value: 0, settled: true });
    });
    it('composes machines and explicit timelines in creation order', async () => {
      const r = await page.evaluate(() => {
        const i = window.motionIcon;
        i.machine('accent');
        i.applyTimeline('t', 1, { mix: 0.5 });
        i.player!.step(0);
        return { values: i.values(), state: i.machine('accent').states() };
      });
      expect(r).toEqual({ values: { 'a.x': 5, 'a.y': 4 }, state: { l: 's' } });
    });
    it('wakes a settled icon on direct handle changes and sleeps after pause', async () => {
      await page.evaluate(() => {
        window.motionFrames = 0;
        const raf = requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (fn) => {
          window.motionFrames++;
          return raf(fn);
        };
        window.motionIcon.play();
        window.motionIcon.timeline('t');
      });
      await expect
        .poll(() => page.evaluate(() => window.motionIcon.values()['a.x'] as number))
        .toBeGreaterThan(0.1);
      await page.evaluate(() => window.motionIcon.timeline('t').pause());
      await expect.poll(() => page.evaluate(() => window.motionIcon.playback)).toBe('settled');
      const frames = await page.evaluate(() => window.motionFrames);
      await page.waitForTimeout(100);
      expect(await page.evaluate(() => window.motionFrames)).toBeLessThanOrEqual(frames + 1);
    });
    it('loads separately bundled markup with channels, work, quantization and machines', async () => {
      await page.addScriptTag({ type: 'module', content: markup });
      await page.waitForFunction(
        () => !!(customElements.get('anima-icon') as typeof AnimaIcon).compiler,
      );
      const source = readFileSync(new URL('examples/motion.animl', root), 'utf8');
      const r = await page.evaluate((source) => {
        const i = window.motionIcon,
          diagnostics = i.load(source, true);
        i.player!.step(0.5);
        i.invalidate();
        return {
          diagnostics,
          meta: i.animations,
          label: i.node('dot')!.get('channels.label'),
          transform: i.shadowRoot!.querySelector('[transform]')!.getAttribute('transform'),
        };
      }, source);
      expect(r.diagnostics).toEqual([]);
      expect(r.meta[0]).toMatchObject({ work: [0.25, 1.75], quantize: 12 });
      expect(r.label).toBe('Ready');
      expect(r.transform).toContain('matrix');
    });
    it('dispatches authored instance events and namespaces named-machine state reports', async () => {
      const r = await page.evaluate(() => {
        const i = window.motionIcon,
          events: unknown[] = [],
          states: unknown[] = [];
        i.addEventListener('anima:event', (e) => events.push((e as CustomEvent).detail));
        i.addEventListener('anima:state', (e) => states.push((e as CustomEvent).detail));
        i.machine('accent');
        i.play();
        i.speed = 20;
        i.timeline('t');
        i.frame(performance.now() + 250);
        return { events, states, values: i.values() };
      });
      expect(r.events).toEqual([{ name: 'middle', layer: 't', time: 1 }]);
      expect(r.states).toContainEqual({ 'accent/l': 's' });
      expect(r.values).toEqual({ 'a.x': 20, 'a.y': 4 });
    });

    it('keeps stale handles detached after a new load', async () => {
      const r = await page.evaluate((d) => {
        const i = window.motionIcon,
          old = i.timeline('t').pause();
        i.load(d);
        i.play();
        old.seek(1);
        return { time: old.time, value: i.values()['a.x'], playback: i.playback };
      }, doc);
      expect(r).toEqual({ time: 1, value: 0, playback: 'settled' });
    });

    it('recovers a connected document when motion registers late', async () => {
      const other = await browser.newPage();
      try {
        await other.setContent('<anima-icon></anima-icon>');
        await other.addScriptTag({ type: 'module', content: base });
        await other.waitForFunction(() => !!customElements.get('anima-icon'));
        await other.evaluate((d) => document.querySelector('anima-icon')!.load(d), doc);
        await other.addScriptTag({ type: 'module', content: motion });
        await other.waitForFunction(() => !!document.querySelector('anima-icon')!.player);
        expect(
          await other.evaluate(() => document.querySelector('anima-icon')!.animations.length),
        ).toBe(1);
      } finally {
        await other.close();
      }
    });
  });
