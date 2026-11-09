import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser, BrowserType, Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Player } from '../../core/src/index.ts';
import type { AnimaIcon } from '../src/index.ts';
import type {} from '../../../modules/text/web/host.ts';
import { cachedBundle } from '../../../tools/browser-cache.ts';

const scene = {
  anima: '0.1',
  name: 'mount-on',
  grid: 20,
  inputs: { on: { type: 'bool', default: false }, go: { type: 'trigger' } },
  nodes: [{ id: 'r', type: 'rect', x0: 0, y0: 0, w: 20, h: 20, fill: { color: '#268060' } }],
  timelines: {
    enter: {
      duration: 0.5,
      tracks: {
        'r.x': [
          [0, 0],
          [0.5, 10],
        ],
      },
      events: [[0.25, 'middle']],
    },
  },
  machine: {
    layers: {
      main: {
        initial: 'off',
        states: {
          off: {
            pose: { 'r.x': 0 },
            on: [
              { to: 'entering', when: 'on', blend: 0.2 },
              { to: 'entering', when: 'go', blend: 0.2 },
            ],
          },
          entering: {
            play: 'enter',
            emit: 'entered',
            on: [{ to: 'on', when: '@end', blend: 0.2 }],
          },
          on: { pose: { 'r.x': 10 }, on: [{ to: 'off', when: '!on', blend: 0.2 }] },
        },
      },
    },
  },
};

export function issueSuite(name: string, engine: BrowserType, executablePath?: string) {
  describe(`WEB issues in ${name}`, () => {
    let browser: Browser, page: Page, js: string;
    beforeAll(async () => {
      if (!executablePath) throw Error('browser absent');
      js = await cachedBundle(resolve('packages/web/src/index.ts'));
      browser = await engine.launch({ executablePath, headless: true });
    }, 30000);
    beforeEach(async () => {
      page = await browser.newPage({
        viewport: { width: 800, height: 600 },
        reducedMotion: 'no-preference',
      });
      page.setDefaultTimeout(15000);
    }, 30000);
    afterEach(async () => {
      await page?.close();
    });
    afterAll(async () => {
      await browser?.close();
    });
    issueTests(
      name,
      () => page,
      () => js,
    );
  });
}

function issueTests(name: string, getPage: () => Page, getJS: () => string) {
  const setup = async (entries: string[] = []) => {
    const page = getPage();
    await page.setContent('<style>body{margin:16px}anima-icon{vertical-align:top}</style>');
    await page.addScriptTag({ type: 'module', content: getJS() });
    await page.evaluate(() => customElements.whenDefined('anima-icon'));
    for (const entry of entries) {
      await page.addScriptTag({
        type: 'module',
        content: await cachedBundle(resolve(`packages/web/src/${entry}.ts`)),
      });
    }
    // Module scripts finish asynchronously after insertion.
    await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
    return page;
  };
  const proof = async (issue: number, data: unknown, visual = false) => {
    console.log(`#${issue} ${name}: ${JSON.stringify(data)}`);
    const phase = process.env.ANIMA_ISSUE_PROOF;
    if (!phase) return;
    const stem = `design/issues/proof/${issue}-${phase}`;
    appendFileSync(stem + '.txt', `${name}: ${JSON.stringify(data, null, 2)}\n`);
    if (visual)
      await getPage().screenshot({
        path: stem + (name === 'Chromium' ? '' : '-firefox') + '.png',
        clip: { x: 12, y: 12, width: 260, height: 240 },
      });
  };

  it('issue #23: uniform viewport, far-edge hits and semantic boxes in SVG and canvas', async () => {
    const page = await setup(['canvas', 'a11y-dom']);
    await page.waitForFunction(
      () =>
        (customElements.get('anima-icon') as typeof AnimaIcon).renderers.canvas &&
        (customElements.get('anima-icon') as typeof AnimaIcon).semanticElement,
    );
    const measured = [];
    for (const renderer of ['svg', 'canvas']) {
      for (const [label, g, x, y, w, h] of [
        ['golem', 32, 0, 0, 31.5, 17.5],
        ['wide', 120, 0, 0, 120, 28],
        ['tall', 180, 0, 0, 120, 180],
        ['offset', 120, -3, -2, 120, 28],
        ['square-bleed', 20, -2, -2, 24, 24],
      ] as const) {
        await page.evaluate(
          ({ renderer, g, x, y, w, h }) => {
            document.querySelector('anima-icon')?.remove();
            const icon = document.createElement('anima-icon');
            icon.setAttribute('renderer', renderer);
            icon.style.cssText = `width:${w}px;height:${h}px`;
            document.body.append(icon);
            const d = icon.load({
              anima: '0.1',
              name: 'box',
              grid: g,
              viewBox: [x, y, w, h],
              requires: ['a11y'],
              inputs: { hit: { type: 'bool', default: false } },
              nodes: [
                {
                  id: 'r',
                  type: 'rect',
                  x0: 0,
                  y0: 0,
                  w,
                  h,
                  fill: { color: '#268060' },
                  a11y: { role: 'button', label: 'control' },
                },
              ],
              listeners: [{ on: 'click', target: 'r', toggle: 'hit' }],
            });
            if (d.some((d) => d.severity === 'error')) throw Error(JSON.stringify(d));
          },
          { renderer, g, x, y, w, h },
        );
        await page.waitForFunction(
          () =>
            !!document
              .querySelector('anima-icon')
              ?.shadowRoot?.querySelector('[data-semantic="r"]'),
        );
        const box = (await page.locator('anima-icon').boundingBox())!;
        await page.mouse.click(box.x + box.width - 2, box.y + box.height / 2);
        const result = await page.evaluate(() => {
          const icon = document.querySelector('anima-icon')!;
          const host = icon.getBoundingClientRect();
          const rect = (el: Element) => {
            const r = el.getBoundingClientRect();
            return [r.x - host.x, r.y - host.y, r.width, r.height];
          };
          return {
            drawing: rect(icon.shadowRoot!.querySelector('svg,canvas')!),
            semantic: rect(icon.shadowRoot!.querySelector('[data-semantic="r"]')!),
            hit: icon.get('hit'),
          };
        });
        if (renderer === 'svg' && label === 'wide' && process.env.ANIMA_ISSUE_PROOF)
          await page.screenshot({
            path: `design/issues/proof/23-${process.env.ANIMA_ISSUE_PROOF}${name === 'Chromium' ? '' : '-firefox'}.png`,
            clip: { x: 12, y: 12, width: 128, height: 36 },
          });
        measured.push({ renderer, label, host: [w, h], ...result });
      }
    }
    await proof(23, measured);
    for (const row of measured) {
      const [w, h] = row.host;
      const s =
        Math.max(w, h) /
        (row.label === 'golem'
          ? 32
          : row.label === 'tall'
            ? 180
            : row.label === 'square-bleed'
              ? 20
              : 120);
      const offsets =
        row.label === 'offset'
          ? [-3 * s, -2 * s]
          : row.label === 'square-bleed'
            ? [-2 * s, -2 * s]
            : [0, 0];
      [offsets[0]!, offsets[1]!, w * s, h * s].forEach((n, i) =>
        expect(row.drawing[i], `${row.renderer} ${row.label} drawing[${i}]`).toBeCloseTo(n, 1),
      );
      [0, 0, w * s, h * s].forEach((n, i) =>
        expect(row.semantic[i], `${row.renderer} ${row.label} semantic[${i}]`).toBeCloseTo(n, 1),
      );
      expect(row.hit, `${row.renderer} ${row.label} far-edge click`).toBe(true);
    }
  }, 30000);

  it('issue #23: an explicitly square host keeps a non-square viewport uniform, including its origin', async () => {
    const page = await setup(['canvas']);
    await page.waitForFunction(
      () => !!(customElements.get('anima-icon') as typeof AnimaIcon).renderers.canvas,
    );
    const rows = [];
    for (const renderer of ['svg', 'canvas']) {
      for (const wide of [true, false]) {
        for (const [x, y] of [
          [0, 0],
          [-3, -2],
        ]) {
          await page.evaluate(
            ({ renderer, wide, x, y }) => {
              document.querySelector('anima-icon')?.remove();
              const icon = document.createElement('anima-icon');
              icon.style.cssText = 'width:200px;height:200px';
              icon.setAttribute('renderer', renderer);
              document.body.append(icon);
              const d = icon.load({
                anima: '0.1',
                name: 'wide-square-host',
                grid: 20,
                viewBox: [x, y, wide ? 72 : 24, wide ? 24 : 72],
                inputs: { hit: { type: 'bool', default: false } },
                nodes: [
                  {
                    id: 'r',
                    type: 'rect',
                    x0: wide ? 12 : 0,
                    y0: wide ? 0 : 12,
                    w: 8,
                    h: 8,
                    fill: { color: '#268060' },
                  },
                ],
                listeners: [{ on: 'click', target: 'r', toggle: 'hit' }],
              });
              if (d.some((d) => d.severity === 'error')) throw Error(JSON.stringify(d));
            },
            { renderer, wide, x, y },
          );
          const host = (await page.locator('anima-icon').boundingBox())!;
          await page.mouse.click(host.x + (wide ? 160 : 40), host.y + (wide ? 40 : 160));
          const row = await page.evaluate(() => {
            const icon = document.querySelector('anima-icon')!,
              host = icon.getBoundingClientRect();
            const r = icon.shadowRoot!.querySelector('svg,canvas')!.getBoundingClientRect();
            return { rect: [r.x - host.x, r.y - host.y, r.width, r.height], hit: icon.get('hit') };
          });
          rows.push({ renderer, wide, x, y, ...row });
        }
      }
    }
    await proof(23, { explicitSquareHost: rows });
    for (const row of rows) {
      [row.x! * 10, row.y! * 10, row.wide ? 720 : 240, row.wide ? 240 : 720].forEach((v, i) =>
        expect(row.rect[i]).toBeCloseTo(v, 1),
      );
      expect(row.hit).toBe(true);
    }
  }, 30000);

  it('issue #24: pre-player writes retain call order through deferred and superseded loads', async () => {
    const page = await setup();
    const result = await page.evaluate(async (scene) => {
      const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
      const probe = document.createElement('anima-icon');
      probe.pause();
      probe.load(scene);
      const proto = Object.getPrototypeOf(probe.player!) as Player;
      const calls: unknown[][] = [];
      const set = proto.set,
        fire = proto.fire;
      proto.set = function (name, value) {
        calls.push(['set', name, value]);
        set.call(this, name, value);
      };
      proto.fire = function (name) {
        calls.push(['fire', name]);
        fire.call(this, name);
      };
      const icon = document.createElement('anima-icon');
      icon.pause();
      document.body.append(icon);
      icon.set('on', false);
      icon.fire('go');
      icon.set('on', true);
      const model = Icon.compile(structuredClone(scene)).model!;
      model.doc.assets = {};
      const finishes: (() => void)[] = [];
      Icon.loadAssets = () => new Promise((resolve) => finishes.push(() => resolve(undefined)));
      icon.loadModel(model);
      icon.set('on', false);
      icon.loadModel(model);
      icon.set('on', true);
      finishes[0]!();
      await Promise.resolve();
      const stale = !icon.player;
      finishes[1]!();
      await icon.ready;
      const order = [...calls];
      proto.set = set;
      proto.fire = fire;
      const before = icon.get('on');
      icon.player!.step(0);
      const after = icon.get('on'),
        states = icon.player!.states();
      icon.loadModel(model);
      finishes[2]!();
      await Promise.resolve();
      icon.player!.step(0);
      const next = icon.get('on');
      // Queued invalid names must take exactly the player's normal error path.
      const bad = document.createElement('anima-icon');
      bad.pause();
      bad.set('absent', true);
      let unknown = '';
      try {
        bad.load(scene);
      } catch (e) {
        unknown = String(e);
      }
      return { stale, before, after, states, next, unknown, order };
    }, scene);
    await proof(24, result);
    expect(result).toMatchObject({
      stale: true,
      before: false,
      after: true,
      states: { main: 'entering' },
      next: false,
    });
    expect(result.unknown).toContain('absent');
    expect(result.order).toEqual([
      ['set', 'on', false],
      ['fire', 'go'],
      ['set', 'on', true],
      ['set', 'on', false],
      ['set', 'on', true],
    ]);
  }, 30000);

  it('P8-8: pre-player toggle shares the set/fire FIFO before the first step and applies once', async () => {
    const page = await setup();
    const result = await page.evaluate(async (scene) => {
      const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
      // A probe exposes the active bundle's Player prototype for first-step observation.
      const probe = document.createElement('anima-icon');
      probe.pause();
      probe.load(scene);
      const proto = Object.getPrototypeOf(probe.player!) as Player;
      const step = proto.step,
        toggle = proto.toggle,
        set = proto.set,
        fire = proto.fire;
      const calls: unknown[][] = [];
      proto.toggle = function (name) {
        calls.push(['toggle', name]);
        toggle.call(this, name);
      };
      proto.set = function (name, value) {
        calls.push(['set', name, value]);
        set.call(this, name, value);
      };
      proto.fire = function (name) {
        calls.push(['fire', name]);
        fire.call(this, name);
      };
      proto.step = function (...args) {
        calls.push(['step']);
        return step.apply(this, args);
      };
      const icon = document.createElement('anima-icon');
      document.body.append(icon);
      icon.toggle('on');
      icon.set('on', false);
      icon.fire('go');
      icon.toggle('on');
      const model = Icon.compile(structuredClone(scene)).model!;
      model.doc.assets = {};
      const finishes: (() => void)[] = [];
      Icon.loadAssets = () => new Promise((resolve) => finishes.push(() => resolve(undefined)));
      icon.loadModel(model);
      icon.toggle('on');
      icon.loadModel(model);
      finishes[0]!();
      await Promise.resolve();
      const stale = !icon.player;
      finishes[1]!();
      await icon.ready;
      const first = { on: icon.get('on'), states: icon.player!.states(), calls: [...calls] };
      proto.step = step;
      proto.toggle = toggle;
      proto.set = set;
      proto.fire = fire;
      icon.pause();
      icon.loadModel(model);
      finishes[2]!();
      await icon.ready;
      icon.player!.step(0);
      const next = { on: icon.get('on'), states: icon.player!.states() };
      // Synchronous loading uses the same queue, and invalid toggles use normal validation.
      const sync = document.createElement('anima-icon');
      sync.toggle('on');
      sync.load(scene);
      const synchronous = sync.get('on');
      const bad = document.createElement('anima-icon');
      bad.toggle('absent');
      let unknown = '';
      try {
        bad.load(scene);
      } catch (error) {
        unknown = String(error);
      }
      return { stale, first, next, synchronous, unknown };
    }, scene);
    expect(result.stale).toBe(true);
    expect(result.first).toEqual({
      on: false,
      states: { main: 'entering' },
      calls: [
        ['toggle', 'on'],
        ['set', 'on', false],
        ['fire', 'go'],
        ['toggle', 'on'],
        ['toggle', 'on'],
        ['step'],
      ],
    });
    expect(result.next).toEqual({ on: false, states: { main: 'off' } });
    expect(result.synchronous).toBe(true);
    expect(result.unknown).toContain('absent');
  }, 30000);

  it('issue #25: settle resolves once timelines/blends silently and queues before first paint', async () => {
    const page = await setup();
    const result = await page.evaluate((scene) => {
      const icon = document.createElement('anima-icon');
      document.body.append(icon);
      const events: string[] = [];
      icon.addEventListener('anima:event', () => events.push('event'));
      icon.addEventListener('anima:state', () => events.push('state'));
      icon.set('on', true);
      const queued = icon.settle?.();
      icon.load(scene);
      const first = { x: icon.values()['r.x'], state: icon.player!.states(), events: [...events] };
      icon.pause();
      icon.set('on', false);
      const paused = icon.settle?.();
      const off = icon.values()['r.x'];
      icon.play();
      events.length = 0;
      icon.set('on', true);
      const playing = icon.settle?.();
      // Next ordinary frame must not leak the suppressed state notification.
      icon.frame(performance.now() + 16);
      const final = {
        x: icon.values()['r.x'],
        playback: icon.playback,
        events: [...events],
        transform: icon.shadowRoot!.querySelector('svg > g')?.getAttribute('transform'),
      };
      const loop = structuredClone(scene);
      Object.assign(loop.timelines.enter, { loop: 'loop' });
      loop.machine.layers.main.states.entering.on = [];
      loop.machine.layers.main.initial = 'entering';
      icon.pause();
      icon.load(loop);
      const time = icon.player!.time;
      const capped = icon.settle?.();
      return {
        queued,
        first,
        paused,
        off,
        playing,
        final,
        capped,
        elapsed: icon.player!.time - time,
      };
    }, scene);
    await proof(25, result);
    expect(result).toMatchObject({
      queued: false,
      first: { x: 10, state: { main: 'on' }, events: [] },
      paused: true,
      off: 0,
      playing: true,
      final: { x: 10, playback: 'settled', events: [], transform: 'matrix(1 0 0 1 10 0)' },
      capped: false,
    });
    expect(result.elapsed).toBe(60);
  }, 30000);

  it('issue #25: deferred settling precedes every draw and re-arms a capped loop', async () => {
    const page = await setup();
    const result = await page.evaluate(async (scene) => {
      const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
      const icon = document.createElement('anima-icon');
      document.body.append(icon);
      const events: string[] = [],
        draws: unknown[] = [];
      icon.addEventListener('anima:event', () => events.push('event'));
      icon.addEventListener('anima:state', () => events.push('state'));
      const previous = Icon.eventHook;
      Icon.eventHook = (host, kind, detail) => {
        previous?.(host, kind, detail);
        if (host === icon && kind === 'draw') draws.push(icon.values()['r.x']);
      };
      let finish!: () => void;
      Icon.loadAssets = () =>
        new Promise((resolve) => {
          finish = () => resolve(undefined);
        });
      const model = Icon.compile(structuredClone(scene)).model!;
      model.doc.assets = {};
      icon.loadModel(model);
      icon.set('on', true);
      const queued = icon.settle();
      finish();
      await icon.ready;
      const first = { x: icon.values()['r.x'], events: [...events], draws: [...draws] };
      icon.pause();
      const loop = structuredClone(scene);
      Object.assign(loop.timelines.enter, { loop: 'loop' });
      loop.machine.layers.main.initial = 'entering';
      loop.machine.layers.main.states.entering.on = [];
      icon.load(loop);
      icon.play();
      const capped = icon.settle(),
        before = icon.player!.time;
      icon.frame(performance.now()); // The freshly armed clock starts at dt=0.
      icon.frame(performance.now() + 100);
      return {
        queued,
        first,
        capped,
        resumed: icon.player!.time > before,
        playback: icon.playback,
      };
    }, scene);
    expect(result).toMatchObject({
      queued: false,
      first: { x: 10, events: [] },
      capped: false,
      resumed: true,
      playback: 'playing',
    });
    expect(result.first.draws.length).toBeGreaterThan(0);
    expect(result.first.draws.every((x) => x === 10)).toBe(true);
  }, 30000);

  it('issue #27: page ::part styles survive textRun, reload and renderer switches', async () => {
    const page = await setup(['text', 'text-host', 'canvas']);
    await page.waitForFunction(
      () =>
        !!document.querySelector('anima-icon') ||
        !!(customElements.get('anima-icon') as typeof AnimaIcon).prototype.textRun,
    );
    await page.addStyleTag({
      content:
        'anima-icon::part(svg){background:rgb(240,210,120);outline:2px solid rgb(180,20,60)}anima-icon::part(canvas){background:rgb(120,210,240)}',
    });
    const result = await page.evaluate(() => {
      const icon = document.createElement('anima-icon');
      icon.pause();
      icon.style.width = '100px';
      document.body.append(icon);
      const doc = {
        anima: '0.1',
        name: 'parts',
        grid: 20,
        requires: ['text'],
        nodes: [
          {
            id: 't',
            type: 'text',
            styles: { s: { font: 'sans-serif', size: 4, fill: { color: '#000' } } },
            runs: [{ id: 'value', style: 's', text: 'hi' }],
          },
        ],
      };
      const d = icon.load(doc);
      if (d.some((d) => d.severity === 'error')) throw Error(JSON.stringify(d));
      const read = () => {
        const el = icon.shadowRoot!.querySelector('svg,canvas')!;
        return { part: el.getAttribute('part'), background: getComputedStyle(el).backgroundColor };
      };
      const initial = read();
      icon.textRun('t', 'value', 'changed');
      const text = read();
      icon.load(doc);
      const reload = read();
      icon.setAttribute('renderer', 'canvas');
      const canvas = read();
      icon.setAttribute('renderer', 'svg');
      const svg = read();
      return { initial, text, reload, canvas, svg };
    });
    await proof(27, result, true);
    for (const key of ['initial', 'text', 'reload', 'svg'] as const)
      expect(result[key]).toEqual({ part: 'svg', background: 'rgb(240, 210, 120)' });
    expect(result.canvas).toEqual({ part: 'canvas', background: 'rgb(120, 210, 240)' });
  }, 30000);
}
