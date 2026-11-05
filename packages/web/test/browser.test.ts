import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox, type Browser, type BrowserType, type Page } from 'playwright-core';
import { PNG } from 'pngjs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { attrs, cssSlots, load, runScript, sceneTree, type El } from '../../core/src/index.ts';
import type { AnimaIcon } from '../src/index.ts';
import { bundle } from '../../../tools/browser-build.ts';

declare global {
  interface Window {
    icon: AnimaIcon;
    rafCalls: number;
    events: string[];
  }
}

const bell = readFileSync(new URL('../../../examples/bell.ani', import.meta.url), 'utf8');
const bellMarkup = readFileSync(new URL('../../../examples/bell.animl', import.meta.url), 'utf8');
/** Browsers to run in: the cached Playwright builds, or CHROMIUM_PATH / FIREFOX_PATH (CI). */
const BROWSERS: [string, BrowserType, string | undefined][] = [
  [
    'Chromium',
    chromium,
    process.env.CHROMIUM_PATH ??
      [
        resolve(
          homedir(),
          '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
        ),
        chromium.executablePath(),
      ].find(existsSync),
  ],
  [
    'Firefox',
    firefox,
    process.env.FIREFOX_PATH ??
      [
        resolve(homedir(), '.cache/ms-playwright/firefox-1555/firefox/firefox'),
        firefox.executablePath(),
      ].find(existsSync),
  ],
];
for (const [name, , path] of BROWSERS)
  if (!path || !existsSync(path))
    console.warn(
      `SKIP <anima-icon> browser suite in ${name}: no executable; set ${name.toUpperCase()}_PATH.`,
    );

// Count requests for frames, including a mistakenly scheduled idle loop. Test waits use timers,
// never rAF polling, so they cannot perturb this counter (research/rive-web-runtime.md §12).
async function countFrames(page: Page) {
  await page.addInitScript(() => {
    window.rafCalls = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (fn) => {
      window.rafCalls++;
      return raf(fn);
    };
  });
}

function traceScript(trace: unknown[][]): string {
  const lines: string[] = [];
  for (let i = 0; i < trace.length; i++) {
    const [kind, ...args] = trace[i]!;
    if (kind === 'step') lines.push(`advance ${String(args[0])}`);
    else if (kind === 'pointer') {
      lines.push(args[0] === 'leave' ? 'pointer leave' : `pointer ${args.map(String).join(' ')}`);
      // A pointer command already steps: consume exactly the immediately following step(0).
      expect(trace[i + 1]).toEqual(['step', 0]);
      i++;
    } else {
      expect(['set', 'fire', 'toggle']).toContain(kind);
      lines.push(`${String(kind)} ${args.map(String).join(' ')}`);
    }
  }
  return lines.join('\n');
}

for (const [name, type, executablePath] of BROWSERS) suite(name, type, executablePath);

function suite(name: string, type: BrowserType, executablePath: string | undefined) {
  describe.skipIf(!executablePath || !existsSync(executablePath))(`<anima-icon> in ${name}`, () => {
    let browser: Browser;
    let page: Page;
    let js: string;
    let markupJs: string;
    beforeAll(async () => {
      [js, markupJs] = await Promise.all([
        bundle(resolve('packages/web/src/index.ts')),
        bundle(resolve('packages/web/src/markup.ts')),
      ]);
      browser = await type.launch({ executablePath, headless: true });
    }, 30000);
    afterAll(async () => {
      await browser?.close();
    });
    beforeEach(async () => {
      page = await browser.newPage({
        viewport: { width: 800, height: 600 },
        reducedMotion: 'no-preference',
      });
      page.setDefaultTimeout(4000);
      await countFrames(page);
    });
    afterEach(async () => {
      await page?.close();
    });

    async function mount(doc = bell, motion?: string) {
      await page.route('https://anima.test/', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: `<style>body{margin:80px}anima-icon{width:200px;height:200px}</style><script type="module">${js}</script>`,
        }),
      );
      await page.goto('https://anima.test/');
      await page.evaluate(
        async ({ doc, motion }) => {
          await customElements.whenDefined('anima-icon');
          const el = (window.icon = document.createElement('anima-icon'));
          el.trace = [];
          window.events = [];
          el.addEventListener('anima:event', (e) =>
            window.events.push((e as CustomEvent).detail.name),
          );
          if (motion) el.setAttribute('motion', motion);
          document.body.append(el);
          const errors = el.load(doc).filter((d) => d.severity === 'error');
          if (errors.length) throw new Error(JSON.stringify(errors));
          await (el as AnimaIcon).ready;
        },
        { doc, motion },
      );
      // Let initial visibility observation complete, without scheduling our own frames.
      await page.waitForFunction(() => window.icon.player && !window.icon.player.busy, undefined, {
        polling: 10,
      });
    }
    async function waitState(layer: string, state: string) {
      await page.waitForFunction(
        ({ layer, state }) => window.icon.player?.states()[layer] === state,
        { layer, state },
        { polling: 10 },
      );
    }
    async function settled() {
      await page.waitForFunction(() => !window.icon.player?.busy, undefined, { polling: 10 });
    }
    async function hover() {
      await page.mouse.move(180, 180);
      await page.waitForFunction(() => window.icon.values()['icon.scale'] === 1.05, undefined, {
        polling: 10,
      });
    }
    async function ring() {
      await page.mouse.click(180, 180);
      await waitState('ring', 'ringing');
    }

    async function markupPage(source: string, withModule = true, src?: string) {
      const messages: string[] = [];
      const requests: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') messages.push(m.text());
      });
      page.on('request', (r) => requests.push(r.url()));
      if (src)
        await page.route('https://anima.test/' + src.split('#')[0], (r) =>
          r.fulfill({ body: source }),
        );
      await page.route('https://anima.test/', (r) =>
        r.fulfill({
          contentType: 'text/html',
          body: `<anima-icon ${src ? `src="${src}"` : ''}>
          ${src ? '' : `<script type="application/vnd.anima+xml">${source}</script>`}
          </anima-icon>
          <script>
          window.icon = document.querySelector('anima-icon');
          window.events = [];
          window.icon.addEventListener('anima:error', e => window.events.push(e.detail));
          </script>
          <script type="module">${withModule ? markupJs : js}</script>`,
        }),
      );
      await page.goto('https://anima.test/');
      await page.evaluate(async () => {
        await customElements.whenDefined('anima-icon');
        await window.icon.ready.catch(() => {});
      });
      return { messages, requests };
    }

    it('compiles inline AniML to the same player and SVG as bell.ani with no extra requests', async () => {
      // Stop automatic frames so paired players receive exactly the same steps.
      await page.addInitScript(() => {
        let now = 0;
        let callbacks: FrameRequestCallback[] = [];
        performance.now = () => now;
        window.requestAnimationFrame = (cb) => callbacks.push(cb);
        window.addEventListener('test:frame', () => {
          now += 100;
          const run = callbacks;
          callbacks = [];
          for (const cb of run) cb(now);
        });
      });
      const { messages, requests } = await markupPage(bellMarkup);
      expect(messages).toEqual([]);
      expect(requests).toEqual(['https://anima.test/']);
      const snapshots = await page.evaluate(async (doc) => {
        const compiled = document.createElement('anima-icon');
        document.body.append(compiled);
        compiled.load(doc);
        await compiled.ready;
        const snapshot = (icon: AnimaIcon) => ({
          values: icon.values(),
          states: icon.player!.states(),
          svg: icon.shadowRoot!.querySelector('svg')!.outerHTML.replace(/a\d+-/g, 'icon-'),
        });
        const pairs = [[snapshot(window.icon), snapshot(compiled)]];
        for (const icon of [window.icon, compiled]) icon.fire('ring');
        for (let i = 0; i < 4; i++) {
          window.dispatchEvent(new Event('test:frame'));
          pairs.push([snapshot(window.icon), snapshot(compiled)]);
        }
        for (let i = 0; i < 16; i++) window.dispatchEvent(new Event('test:frame'));
        pairs.push([snapshot(window.icon), snapshot(compiled)]);
        return pairs;
      }, bell);
      for (const [markup, compiled] of snapshots) expect(markup).toEqual(compiled);
      expect(snapshots[1]![0]!.states.ring).toBe('ringing');
      expect(snapshots.at(-1)![0]!.states.ring).toBe('rested');
    });

    it('compiles .animl src URLs including a query and fragment', async () => {
      const { messages, requests } = await markupPage(bellMarkup, true, 'bell.animl?v=1#icon');
      expect(messages).toEqual([]);
      expect(requests).toEqual(['https://anima.test/', 'https://anima.test/bell.animl?v=1']);
      expect(await page.evaluate(() => window.icon.player!.model.doc)).toEqual(JSON.parse(bell));
    });

    it('registers on an already loaded base runtime', async () => {
      // Importing the optional bundle after the base extends the registered class,
      // even when the browser bundle contains another copy of the runtime.
      await mount();
      await page.addScriptTag({ type: 'module', content: markupJs });
      await page.waitForFunction(
        () => !!(customElements.get('anima-icon') as typeof AnimaIcon).compiler,
      );
      const result = await page.evaluate(async (source) => {
        const icon = document.createElement('anima-icon');
        const script = document.createElement('script');
        script.type = 'application/vnd.anima+xml';
        script.textContent = source;
        icon.append(script);
        document.body.append(icon);
        await icon.ready;
        return icon.player!.model.doc;
      }, bellMarkup);
      expect(result).toEqual(JSON.parse(bell));
    });

    it.each([
      {
        source:
          '<anima version="0.1" name="broken" grid="20">\n  <circle id="dot" cx="bad" cy="2" r="1"/>\n</anima>',
        code: 'bad-attribute',
        pointer: '/nodes/0/center',
        line: 2,
        column: 24,
      },
      {
        source:
          '<anima version="0.1" name="broken" grid="20">\n  <circle id="dot" cx="0" cy="2" r="-1"/>\n</anima>',
        code: 'bad-value',
        pointer: '/nodes/0/r',
        line: 2,
        column: 37,
      },
      {
        source:
          '<anima version="0.1" name="broken" grid="20">\n  <circle id="dot" cx="&#1114112;" cy="2" r="1"/>\n</anima>',
        code: 'markup-syntax',
        pointer: '',
        line: 2,
        column: 24,
      },
      {
        source: '<anima>\n<circle></anima>',
        code: 'markup-syntax',
        pointer: '',
        line: 2,
        column: 9,
      },
    ])(
      'reports $code at $line:$column through anima:error, ready, and console',
      async ({ source, ...diagnostic }) => {
        const { messages } = await markupPage(source);
        const errors = await page.evaluate(async () => ({
          event: window.events[0],
          ready: await window.icon.ready.catch((d: unknown) => d),
          empty: !window.icon.player && !window.icon.shadowRoot!.querySelector('svg'),
        }));
        expect(errors.event).toEqual(errors.ready);
        expect(errors.event).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ ...diagnostic, severity: 'error', message: diagnostic.code }),
          ]),
        );
        expect(errors.empty).toBe(true);
        expect(messages.join('\n')).toContain(
          `${diagnostic.code} at ${diagnostic.line}:${diagnostic.column}`,
        );
      },
    );

    it.each([undefined, 'bell.animl'])(
      'explains how to enable markup without the module (src=%s)',
      async (src) => {
        const { messages, requests } = await markupPage(bellMarkup, false, src);
        const errors = await page.evaluate(async () => ({
          event: window.events[0],
          ready: await window.icon.ready.catch((d: unknown) => d),
          empty: !window.icon.player,
        }));
        expect(errors.event).toEqual(errors.ready);
        expect(errors.event).toEqual([
          expect.objectContaining({
            code: 'markup-unavailable',
            severity: 'error',
            pointer: '',
            message: 'load @anima-format/web/markup or run anima build page.html',
          }),
        ]);
        expect(errors.empty).toBe(true);
        expect(messages.join('\n')).toContain(
          'load @anima-format/web/markup or run anima build page.html',
        );
        expect(requests).toEqual(
          src ? ['https://anima.test/', 'https://anima.test/bell.animl'] : ['https://anima.test/'],
        );
      },
    );

    it('real mouse hovers, presses, rings, rests with a knockout, and leaves', async () => {
      await mount();
      await hover();
      await page.mouse.down();
      await waitState('hover', 'press');
      await page.waitForFunction(() => window.icon.values()['icon.scale'] === 0.95, undefined, {
        polling: 10,
      });
      await page.mouse.up();
      await page.waitForFunction(() => window.events.includes('rang'), undefined, { polling: 10 });
      await waitState('ring', 'rested');
      await settled();
      expect(await page.evaluate(() => window.icon.player!.states())).toEqual({
        ring: 'rested',
        hover: 'hover',
      });
      expect(await page.evaluate(() => window.icon.values()['dot.scale'])).toBe(1);
      expect(await page.locator('anima-icon').locator('g[mask]').count()).toBe(1);
      await page.mouse.move(500, 400);
      await waitState('hover', 'rest');
      await settled();
      expect(await page.evaluate(() => window.icon.values()['icon.scale'])).toBe(1);
    });

    it('exposes button semantics; Enter activates on down, Space on up, and held follows keys', async () => {
      await mount();
      expect(await page.locator('anima-icon').getAttribute('role')).toBe('button');
      expect(await page.locator('anima-icon').getAttribute('aria-label')).toBe('Ring the bell');
      expect(await page.locator('anima-icon').getAttribute('tabindex')).toBe('0');
      await page.locator('anima-icon').focus();
      await page.keyboard.down('Enter');
      await page.waitForFunction(() => window.events.includes('rang'), undefined, { polling: 10 });
      expect(await page.evaluate(() => window.icon.player!.get('down'))).toBe(true);
      await page.keyboard.up('Enter');
      await settled();
      expect(await page.evaluate(() => window.icon.player!.get('down'))).toBe(false);
      await page.keyboard.down('Space');
      await page.waitForFunction(() => window.icon.player!.get('down') === true, undefined, {
        polling: 10,
      });
      expect(await page.evaluate(() => window.events.filter((e) => e === 'rang').length)).toBe(1);
      await page.keyboard.up('Space');
      await page.waitForFunction(
        () => window.events.filter((e) => e === 'rang').length === 2,
        undefined,
        { polling: 10 },
      );
      expect(await page.evaluate(() => window.icon.player!.get('down'))).toBe(false);
    });

    it('reduces a click to at most two frames, reports timeline events, and honors motion=full', async () => {
      const doc = JSON.parse(bell);
      // The reference bell has only a state emit; add timeline events to test the §10 guarantee.
      doc.timelines.ring.events = [
        [0, 'start'],
        [0.7, 'middle'],
        [1.4, 'end'],
      ];
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await mount(JSON.stringify(doc));
      await page.mouse.move(180, 180);
      await settled();
      const before = await page.evaluate(() => window.rafCalls);
      // mouse.click also sends a pointermove, which can wake its own frame in Firefox.
      // The pointer is already positioned: count only the real click's down/up work.
      await page.mouse.down();
      await page.mouse.up();
      await waitState('ring', 'rested');
      expect((await page.evaluate(() => window.rafCalls)) - before).toBeLessThanOrEqual(2);
      expect(await page.evaluate(() => window.events)).toEqual(['rang', 'start', 'middle', 'end']);
      expect(await page.evaluate(() => window.icon.values()['dot.scale'])).toBe(1);
      await page.evaluate(() => {
        window.icon.setAttribute('motion', 'full');
        window.icon.fire('ring');
      });
      await waitState('ring', 'ringing');
      expect(await page.evaluate(() => window.icon.player!.reducedMotion)).toBe(false);
      expect(await page.evaluate(() => window.icon.values()['dot.scale'])).toBe(0);
      await waitState('ring', 'rested');
    });

    it('inherits color and accent through CSS, including a dark media rule', async () => {
      await mount();
      await page.addStyleTag({
        content:
          'anima-icon{color:rgb(12,34,56);--anima-accent:rgb(78,90,123)} @media(prefers-color-scheme:dark){anima-icon{color:rgb(210,220,230);--anima-accent:rgb(150,160,170)}}',
      });
      const fills = () =>
        page.evaluate(() => {
          const root = window.icon.shadowRoot!;
          return [
            root.querySelector('svg > g path[fill-rule]')!,
            root.querySelector('svg > g circle[fill]')!,
          ].map((el) => getComputedStyle(el).fill);
        });
      expect(await fills()).toEqual(['rgb(12, 34, 56)', 'rgb(78, 90, 123)']);
      await page.emulateMedia({ colorScheme: 'dark' });
      expect(await fills()).toEqual(['rgb(210, 220, 230)', 'rgb(150, 160, 170)']);
    });

    it('ships a current standalone demo with only its file document request and no canvas/wasm/watermark', async () => {
      execFileSync(process.execPath, ['tools/build-web.ts', '--check'], { encoding: 'utf8' });
      const requests: string[] = [];
      page.on('request', (r) => requests.push(r.url()));
      const url = pathToFileURL(resolve('examples/web/index.html')).href;
      await page.goto(url);
      await page.locator('anima-icon').evaluate(async (el) => {
        await (el as AnimaIcon).ready;
      });
      await page.locator('anima-icon').click();
      await page.waitForFunction(
        () => document.querySelector('anima-icon')!.player!.states().ring === 'rested',
        undefined,
        { polling: 10 },
      );
      // Chromium reports the file:// document as a request, Firefox reports nothing; either way
      // nothing but the document itself may be fetched.
      expect(requests.filter((r) => r !== url)).toEqual([]);
      // Also rule out an embedded wasm payload, which would make no network request.
      expect(await page.locator('script[type="module"]').textContent()).not.toMatch(
        /\bWebAssembly\b|\.wasm\b/,
      );
      expect(
        await page.locator('script[src], canvas, [id*="watermark"], [class*="watermark"]').count(),
      ).toBe(0);
      expect(
        await page.locator('anima-icon').locator('canvas, text, image, foreignObject').count(),
      ).toBe(0);
      expect(await page.locator('anima-icon').locator('svg').count()).toBe(1);
      expect(
        await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name)),
      ).toEqual([]);
      expect(await page.locator('#count').textContent()).toBe('Rang once.');
    }, 15000);

    it('sleeps for 500 ms once settled and wakes on fire', async () => {
      await mount();
      await ring();
      await waitState('ring', 'rested');
      await settled();
      const count = await page.evaluate(() => window.rafCalls);
      await page.waitForTimeout(500); // The idle interval itself is the assertion.
      expect(await page.evaluate(() => window.rafCalls)).toBe(count);
      await page.evaluate(() => window.icon.fire('ring'));
      await waitState('ring', 'ringing');
      expect(await page.evaluate(() => window.rafCalls)).toBeGreaterThan(count);
    });

    it('replays the real interaction exactly and matches every retained SVG attribute in scene order', async () => {
      await mount();
      await hover();
      await ring();
      await waitState('ring', 'rested');
      await settled();
      await page.mouse.move(500, 400);
      await waitState('hover', 'rest');
      await settled();
      const actual = await page.evaluate(() => {
        const svg = window.icon.shadowRoot!.querySelector('svg')!;
        return {
          trace: window.icon.trace!,
          values: window.icon.values(),
          states: window.icon.player!.states(),
          prefix: svg.querySelector('mask')!.id.replace(/k\d+$/, ''),
          svg: {
            tag: svg.localName,
            attrs: Object.fromEntries([...svg.attributes].map((a) => [a.name, a.value])),
          },
          elements: [...svg.querySelectorAll('*')].map((el) => ({
            tag: el.localName,
            attrs: Object.fromEntries([...el.attributes].map((a) => [a.name, a.value])),
          })),
        };
      });
      expect(actual.trace.some(([kind]) => kind === 'pointer')).toBe(true);
      const model = load(bell).model!;
      const { player } = runScript(model, traceScript(actual.trace));
      expect(actual.values).toEqual(player.values());
      expect(actual.states).toEqual(player.states());
      const tree = sceneTree(model);
      const flatten = (el: El): { tag: string; attrs: Record<string, string | null> }[] => [
        {
          tag: el.tag,
          attrs: Object.fromEntries(
            Object.entries(attrs(player, el, cssSlots, actual.prefix)).filter(
              ([, v]) => v !== null,
            ),
          ),
        },
        ...el.kids.flatMap(flatten),
      ];
      expect(actual.svg).toEqual({
        tag: 'svg',
        attrs: { viewBox: model.viewBox.join(' '), 'aria-hidden': 'true' },
      });
      expect(actual.elements).toEqual([
        ...(tree.defs.length ? [{ tag: 'defs', attrs: {} }, ...tree.defs.flatMap(flatten)] : []),
        ...tree.root.flatMap(flatten),
      ]);
    });

    it('paints the clapper with the swing on every frame (hover, ring, ring again while hovering)', async () => {
      // Regression for a Firefox (macOS, GPU) bug: the clapper, a transformed leaf inside the
      // swinging, masked group, was painted stale while the swing moved. Body and clapper are
      // recoloured so their pixels can be told apart; every frame, each part's pixel centroid must
      // sit where the player's world matrices put it.
      const doc = JSON.parse(bell);
      const swing = doc.nodes[0].children[1].children;
      swing[0].fill.color = '#0000ff'; // body
      swing[1].fill.color = '#ff0000'; // clapper
      // A manual frame clock: rAF callbacks and performance.now advance only on __tick(ms), so a
      // screenshot can never let the runtime step between the capture and reading its matrices.
      await page.addInitScript(() => {
        let now = 0;
        let queue: FrameRequestCallback[] = [];
        window.requestAnimationFrame = (cb) => queue.push(cb);
        performance.now = () => now;
        (window as unknown as { __tick: (ms: number) => void }).__tick = (ms) => {
          now += ms;
          const run = queue;
          queue = [];
          for (const cb of run) cb(now);
        };
      });
      await mount(JSON.stringify(doc));
      // 400 px icon: 20 px per grid unit, so anti-aliasing stays far below the tolerance.
      await page.setViewportSize({ width: 800, height: 800 });
      await page.evaluate(() => {
        window.icon.style.width = window.icon.style.height = '400px';
      });
      const box = (await page.locator('anima-icon').boundingBox())!;
      const unit = box.width / 20;
      // Clip a square around the icon including its bleed.
      const clip = {
        x: box.x - 2 * unit,
        y: box.y - 2 * unit,
        width: 24 * unit,
        height: 24 * unit,
      };
      const centroids = async () => {
        const png = PNG.sync.read(await page.screenshot({ clip }));
        const sum = { r: [0, 0, 0], b: [0, 0, 0] };
        for (let y = 0; y < png.height; y++)
          for (let x = 0; x < png.width; x++) {
            const i = (y * png.width + x) * 4;
            const [r, g, b] = [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!];
            const k =
              r > 200 && g < 70 && b < 70 ? sum.r : b > 200 && r < 70 && g < 70 ? sum.b : null;
            if (k) {
              k[0]++;
              k[1] += x;
              k[2] += y;
            }
          }
        // pixels → grid units (the clip starts at grid (-2, -2))
        const c = (k: number[]) => [k[1]! / k[0]! / unit - 2, k[2]! / k[0]! / unit - 2];
        return { clapper: c(sum.r), body: c(sum.b) };
      };
      const worlds = () =>
        page.evaluate(() => {
          const p = window.icon.player!;
          const id = (n: string) => p.model.ids.get(n)!;
          return { clapper: p.world(id('clapper')), body: p.world(id('body')), t: p.time };
        });
      type M = number[];
      const apply = (m: M, [x, y]: number[]) => [
        m[0]! * x! + m[2]! * y! + m[4]!,
        m[1]! * x! + m[3]! * y! + m[5]!,
      ];
      const invert = (m: M): M => {
        const d = m[0]! * m[3]! - m[1]! * m[2]!;
        return [
          m[3]! / d,
          -m[1]! / d,
          -m[2]! / d,
          m[0]! / d,
          (m[2]! * m[5]! - m[3]! * m[4]!) / d,
          (m[1]! * m[4]! - m[0]! * m[5]!) / d,
        ];
      };
      // Local centroids from the rest frame.
      const rest = await centroids();
      const w0 = await worlds();
      const local = {
        clapper: apply(invert(w0.clapper), rest.clapper),
        body: apply(invert(w0.body), rest.body),
      };
      let frames = 0;
      let prev: number[] | undefined;
      let worst = 0;
      const frame = async (checkBody: (t: number) => boolean): Promise<number> => {
        await page.evaluate(() =>
          (window as unknown as { __tick: (ms: number) => void }).__tick(16),
        );
        const [got, w] = [await centroids(), await worlds()];
        const want = apply(w.clapper, local.clapper);
        const err = Math.hypot(got.clapper[0]! - want[0]!, got.clapper[1]! - want[1]!);
        worst = Math.max(worst, err);
        expect(err, `${name} clapper at t=${w.t.toFixed(3)} s`).toBeLessThan(0.1);
        if (checkBody(w.t)) {
          const wb = apply(w.body, local.body);
          expect(
            Math.hypot(got.body[0]! - wb[0]!, got.body[1]! - wb[1]!),
            `${name} body at t=${w.t.toFixed(3)} s`,
          ).toBeLessThan(0.1);
        }
        // No jump beyond what the model moved this frame (+ anti-aliasing noise).
        if (prev) {
          const moved = Math.hypot(want[0]! - prev[0]!, want[1]! - prev[1]!);
          const step = Math.hypot(got.clapper[0]! - prev[0]!, got.clapper[1]! - prev[1]!);
          expect(step, `${name} clapper jump at t=${w.t.toFixed(3)} s`).toBeLessThan(moved + 0.1);
        }
        prev = got.clapper;
        frames++;
        return w.t;
      };
      // Step a fixed number of 16 ms clock frames (the player stops advancing once it settles).
      const run = async (seconds: number, checkBody: (t: number) => boolean) => {
        const t0 = (await worlds()).t;
        for (let k = 0; k < Math.ceil(seconds / 0.016); k++) await frame((t) => checkBody(t - t0));
      };
      // First hover: the hover crossfade scales and tilts the whole icon.
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await run(0.3, () => true);
      // First ring (body checked until the dot appears; its knockout then cuts the body).
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await run(1.45, (t) => t < 0.6);
      expect(await page.evaluate(() => window.icon.player!.states())).toEqual({
        ring: 'rested',
        hover: 'hover',
      });
      // Second ring while still hovering: the reported sequence.
      prev = undefined;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await run(1.45, (t) => t < 0.6);
      expect(await page.evaluate(() => window.icon.player!.states())).toEqual({
        ring: 'rested',
        hover: 'hover',
      });
      expect(frames).toBeGreaterThan(200);
      console.log(
        `${name}: ${frames} frames, worst clapper centroid error ${worst.toFixed(3)} grid units`,
      );
    }, 240000);

    it('pauses off-screen mid-ring and resumes when visible', async () => {
      await mount();
      await ring();
      await page.evaluate(() => {
        window.icon.style.transform = 'translateY(2000px)';
      });
      // IntersectionObserver is asynchronous; allow its notification and any queued frame to drain.
      await page.waitForTimeout(100);
      const paused = await page.evaluate(() => ({
        calls: window.rafCalls,
        trace: window.icon.trace!.length,
        values: window.icon.values(),
      }));
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => window.rafCalls)).toBe(paused.calls);
      expect(await page.evaluate(() => window.icon.trace!.length)).toBe(paused.trace);
      expect(await page.evaluate(() => window.icon.values())).toEqual(paused.values);
      expect(await page.evaluate(() => window.icon.player!.states().ring)).toBe('ringing');
      await page.evaluate(() => {
        window.icon.style.transform = '';
      });
      await waitState('ring', 'rested');
      expect(await page.evaluate(() => window.rafCalls)).toBeGreaterThan(paused.calls);
      expect(await page.evaluate(() => window.icon.values()['dot.scale'])).toBe(1);
    });
  });
}
