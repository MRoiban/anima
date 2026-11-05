import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright-core';
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
const executablePath =
  process.env.CHROMIUM_PATH ??
  [
    resolve(
      homedir(),
      '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
    ),
    chromium.executablePath(),
  ].find(existsSync);
const available = !!executablePath && existsSync(executablePath);
if (!available)
  console.warn('SKIP <anima-icon> browser suite: no Chromium executable; set CHROMIUM_PATH.');

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

describe.skipIf(!available)('<anima-icon> in Chromium', () => {
  let browser: Browser;
  let page: Page;
  let js: string;
  beforeAll(async () => {
    js = await bundle(resolve('packages/web/src/index.ts'));
    browser = await chromium.launch({ executablePath, headless: true });
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
    await page.mouse.click(180, 180);
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
    expect(requests).toEqual([url]);
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
          Object.entries(attrs(player, el, cssSlots, actual.prefix)).filter(([, v]) => v !== null),
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
