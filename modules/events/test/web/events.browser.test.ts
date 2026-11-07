import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type Page } from 'playwright-core';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../web/index.ts';
declare global {
  interface Window {
    finishDecode: () => void;
    eventIcon: AnimaIcon;
    observed: string[];
    opened: unknown[][];
    audioLog: string[];
    audioGains: number[];
  }
}
const doc = {
  anima: '0.1',
  name: 'events',
  grid: 20,
  requires: ['events'],
  nodes: [{ id: 'a', type: 'circle', center: [10, 10], r: 1, fill: { color: '#000' } }],
  eventDefs: {
    ping: {
      payload: { n: { type: 'number', value: 3 } },
      url: 'https://example.com/path',
      target: '_blank',
    },
  },
  timelines: { t: { duration: 1, tracks: {}, events: [[0.1, 'ping']] } },
  machine: { layers: { main: { initial: 's', states: { s: { play: 't' } } } } },
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
  describe.skipIf(!existsSync(executablePath))(`events in ${name}`, () => {
    let browser: Browser,
      page: Page,
      base: string,
      events: string,
      assets: string,
      components: string;
    let repeatModules: string[];
    beforeAll(async () => {
      [base, events, assets, components] = await Promise.all(
        ['index', 'events', 'assets', 'components'].map((n) =>
          bundle(new URL(`../../../../packages/web/src/${n}.ts`, import.meta.url).pathname),
        ),
      );
      repeatModules = await Promise.all(
        ['data', 'bind', 'lists'].map((n) => bundle(resolve('packages/web/src/' + n + '.ts'))),
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
        '<anima-icon paused motion="full" style="width:100px;height:100px"></anima-icon>',
      );
      await page.addScriptTag({ type: 'module', content: base });
      await page.waitForFunction(() => !!customElements.get('anima-icon'));
      await page.addScriptTag({ type: 'module', content: events });
      await page.waitForFunction(() => !!document.querySelector('anima-icon')!.on);
      await page.evaluate((d) => {
        window.eventIcon = document.querySelector('anima-icon')!;
        window.observed = [];
        window.opened = [];
        window.open = (...args) => {
          window.opened.push(args);
          return null;
        };
        window.eventIcon.load(d);
      }, doc);
    });
    afterEach(async () => {
      await page.close();
    });
    it.each([false, true])(
      'plays a trusted repeated-row click (nested=%s), using its scoped clip',
      async (nested) => {
        for (const content of [assets, components, ...repeatModules])
          await page.addScriptTag({ type: 'module', content });
        await page.waitForFunction(() =>
          (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('lists'),
        );
        const wave =
          'data:audio/wav;base64,' +
          readFileSync(new URL('../../examples/share-tone.wav', import.meta.url)).toString(
            'base64',
          );
        const result = await page.evaluate(
          ({ wave, nested }) => {
            window.audioLog = [];
            window.observed = [];
            Object.defineProperty(window, 'AudioContext', {
              value: class {
                destination = {};
                async resume() {}
                async close() {}
                createGain() {
                  return { gain: { value: 1 }, connect() {}, disconnect() {} };
                }
                async decodeAudioData(bytes: ArrayBuffer) {
                  if (new TextDecoder().decode(bytes.slice(0, 4)) !== 'RIFF')
                    throw Error('not WAV');
                  window.audioLog.push('decode');
                  return { duration: 2 };
                }
                createBufferSource() {
                  return {
                    connect() {},
                    disconnect() {},
                    stop() {},
                    start(...args: number[]) {
                      window.audioLog.push(JSON.stringify(args));
                    },
                  };
                }
              },
            });
            const leaf = {
              grid: 20,
              nodes: [{ id: 'hit', type: 'circle', center: [5, 5], r: 4, fill: { color: '#000' } }],
              listeners: [{ on: 'click', target: 'hit', emit: 'play' }],
              eventDefs: { play: { audio: 'tone' } },
            };
            const row = {
              ...leaf,
              assets: { tone: { type: 'audio', source: wave, start: 0.2, end: 1 } },
              ...(nested
                ? {
                    nodes: [{ id: 'inside', type: 'instance', component: 'leaf' }],
                    listeners: [],
                    eventDefs: {},
                  }
                : {}),
            };
            const icon = window.eventIcon;
            icon.on('event', ({ detail }) => window.observed.push(detail.name));
            icon.on('error', ({ detail }) => window.observed.push(JSON.stringify(detail)));
            const diagnostics = icon.load({
              anima: '0.1',
              name: 'repeat-audio',
              grid: 20,
              requires: ['events', 'assets', 'components', 'data', 'bind', 'lists'],
              assets: {
                tone: { type: 'audio', source: 'data:audio/wav;base64,AAAA', start: 0, end: 0.5 },
              },
              data: {
                models: {
                  Board: { properties: { items: { type: 'list', of: 'Item', default: [{}, {}] } } },
                  Item: { properties: {} },
                },
              },
              components: { row, leaf },
              nodes: [{ id: 'rows', type: 'repeat', list: '$items', component: 'row', dy: 10 }],
            });
            icon.play();
            return diagnostics;
          },
          { wave, nested },
        );
        expect(result.filter((d) => d.severity === 'error')).toEqual([]);
        const selector = nested
          ? 'g[id$="rows/1/inside/hit"] circle'
          : 'g[id$="rows/1/hit"] circle';
        await page.locator('anima-icon').locator(selector).click();
        await page.waitForFunction(
          () => window.audioLog.some((s) => s.startsWith('[')),
          undefined,
          { polling: 10 },
        );
        expect(
          await page.evaluate(() => ({
            audio: window.audioLog,
            events: window.observed,
            active: navigator.userActivation.hasBeenActive,
          })),
        ).toEqual({
          audio: ['decode', '[0,0.2,0.8]'],
          events: [nested ? 'rows.1.inside.play' : 'rows.1.play'],
          active: true,
        });
      },
    );
    it('delivers payloads, advance/draw/state and supports unsubscribe/deduplication', async () => {
      const result = await page.evaluate(() => {
        const i = window.eventIcon,
          seen: unknown[] = [];
        const cb = (e: CustomEvent) => seen.push(e.detail);
        i.on('advance', () => window.observed.push('advance'));
        i.on('draw', () => window.observed.push('draw'));
        i.on('statechange', () => window.observed.push('statechange'));
        i.on('event', cb);
        const off = i.on('event', cb);
        i.play();
        i.frame(performance.now() + 200);
        off();
        i.unsubscribeAll();
        i.pause();
        return { seen, observed: window.observed, opened: window.opened };
      });
      expect(result.seen).toEqual([expect.objectContaining({ name: 'ping', payload: { n: 3 } })]);
      expect(result.observed).toEqual(expect.arrayContaining(['advance', 'draw', 'statechange']));
      expect(result.opened).toEqual([]);
    });
    it.each(['_blank', '_self', '_parent', '_top'])(
      'gates URL target %s on explicit host permission',
      async (target) => {
        const result = await page.evaluate(
          ({ d, target }) => {
            const i = window.eventIcon;
            d.eventDefs.ping.target = target;
            i.load(d);
            i.setAttribute('url-policy', 'allow');
            i.play();
            i.frame(performance.now() + 200);
            i.pause();
            return window.opened;
          },
          { d: doc, target },
        );
        expect(result).toEqual([['https://example.com/path', target, 'noopener']]);
      },
    );
    it('enforces URL scheme and same origin for relative references even with permissive policy', async () => {
      const result = await page.evaluate(() => {
        const i = window.eventIcon;
        i.urlPolicy = () => true;
        const hook = (customElements.get('anima-icon') as typeof AnimaIcon).eventHook!;
        for (const url of [
          'javascript:alert(1)',
          'data:text/html,x',
          '//evil.test/x',
          '\\\\evil.test/x',
        ])
          hook(i, 'event', { name: 'x', time: 0, layer: null, url, target: '_blank' });
        return window.opened;
      });
      expect(result).toEqual([]);
    });
    it('load/loaderror, pause/play/stop and destroy subscriptions', async () => {
      const result = await page.evaluate((d) => {
        const i = window.eventIcon;
        for (const t of ['load', 'loaderror', 'error', 'pause', 'play', 'stop'])
          i.on(t, () => window.observed.push(t));
        i.load(d);
        i.play();
        i.pause();
        i.stop();
        i.load({});
        i.play();
        return window.observed;
      }, doc);
      expect(result).toEqual(
        expect.arrayContaining(['load', 'loaderror', 'error', 'pause', 'play', 'stop']),
      );
    });
    it('share example increments past ten and sends its generated tone through the audio request path', async () => {
      const binding = await bundle(
        new URL('../../../../packages/web/src/bind.ts', import.meta.url).pathname,
      );
      await page.addScriptTag({ type: 'module', content: binding });
      await page.addScriptTag({ type: 'module', content: assets });
      await page.waitForFunction(
        () =>
          (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('bind') &&
          (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('assets'),
      );
      const share = JSON.parse(
        readFileSync(new URL('../../examples/share.ani', import.meta.url), 'utf8'),
      );
      share.assets.tone.source =
        'data:audio/wav;base64,' +
        readFileSync(new URL('../../examples/share-tone.wav', import.meta.url)).toString('base64');
      await page.evaluate((d) => {
        window.audioLog = [];
        class AudioRequest {
          destination = {};
          createGain() {
            return { gain: { value: 1 }, connect() {}, disconnect() {} };
          }
          async resume() {}
          async close() {}
          async decodeAudioData(data: ArrayBuffer) {
            if (new TextDecoder().decode(data.slice(0, 4)) !== 'RIFF')
              throw Error('expected the generated WAV');
            window.audioLog.push('decode');
            return {};
          }
          createBufferSource() {
            return {
              connect() {},
              disconnect() {},
              start() {
                window.audioLog.push('start');
              },
              stop() {},
            };
          }
        }
        Object.defineProperty(window, 'AudioContext', { value: AudioRequest });
        Object.defineProperty(navigator, 'userActivation', {
          configurable: true,
          value: { hasBeenActive: true },
        });
        window.eventIcon.load(d);
      }, share);
      await page.waitForFunction(
        () => !!window.eventIcon.player && window.eventIcon.player.model.doc.name === 'share',
      );
      const result = await page.evaluate(() => {
        const i = window.eventIcon;
        const events: { name: string; count?: unknown; audio?: string }[] = [];
        i.on('event', ({ detail: e }) => {
          if (e.name === 'shared')
            events.push({ name: e.name, count: e.payload?.count, audio: e.audio });
          if (e.name === 'milestone') events.push({ name: e.name });
        });
        let now = performance.now();
        i.play();
        i.frame(now);
        for (let n = 0; n < 15; n++) {
          i.player!.pointer('down', 10, 10);
          i.player!.pointer('up', 10, 10);
          i.frame(now);
          i.frame((now += 200));
          i.frame((now += 200));
        }
        i.pause();
        return { count: i.get('count'), events, opened: window.opened };
      });
      expect(result.count).toBe(15);
      expect(result.events.filter((e) => e.name === 'shared')).toEqual(
        Array.from({ length: 15 }, (_, n) => ({ name: 'shared', count: n + 1, audio: 'tone' })),
      );
      expect(result.events.filter((e) => e.name === 'milestone')).toHaveLength(3);
      expect(result.opened).toEqual([]);
      await page.waitForFunction(() => window.audioLog.filter((s) => s === 'start').length === 15);
      expect(await page.evaluate(() => window.audioLog.filter((s) => s === 'decode').length)).toBe(
        1,
      );
    });
    it('plays audio clip offsets and reports decoded-bound failures without starting a source', async () => {
      await page.evaluate(() => {
        window.audioLog = [];
        Object.defineProperty(window, 'AudioContext', {
          configurable: true,
          value: class {
            destination = {};
            async resume() {}
            async close() {}
            createGain() {
              return { gain: { value: 1 }, connect() {}, disconnect() {} };
            }
            async decodeAudioData() {
              return { duration: 2 };
            }
            createBufferSource() {
              return {
                buffer: null,
                onended: null,
                connect() {},
                disconnect() {},
                stop() {},
                start(...args: number[]) {
                  window.audioLog.push(JSON.stringify(args));
                },
              };
            }
          },
        });
        const icon = window.eventIcon;
        icon.player!.model.doc.assets = {
          tone: { type: 'audio', source: 'unused', start: 0.2, end: 0.9 },
        };
        icon.assets = async () => new Blob([new Uint8Array([0])]);
      });
      await page.mouse.click(1, 1);
      await page.evaluate(() => {
        (customElements.get('anima-icon') as typeof AnimaIcon).eventHook!(
          window.eventIcon,
          'event',
          { name: 'clip', layer: null, time: 0, audio: 'tone' },
        );
      });
      await page.waitForFunction(() => window.audioLog.length === 1);
      expect(await page.evaluate(() => window.audioLog)).toEqual(['[0,0.2,0.7]']);
      const error = await page.evaluate(async () => {
        const icon = window.eventIcon;
        icon.player!.model.doc.assets.tone.end = 3;
        const result = new Promise((resolve) =>
          icon.addEventListener('anima:error', (event) => resolve((event as CustomEvent).detail), {
            once: true,
          }),
        );
        (customElements.get('anima-icon') as typeof AnimaIcon).eventHook!(icon, 'event', {
          name: 'clip',
          layer: null,
          time: 0,
          audio: 'tone',
        });
        return result;
      });
      expect(error).toEqual([
        expect.objectContaining({
          code: 'event-audio-load',
          pointer: '/assets/tone/source',
          message: expect.stringMatching(/./),
          hint: expect.stringMatching(/./),
        }),
      ]);
      expect(await page.evaluate(() => window.audioLog)).toHaveLength(1);
    });
    it('drops pre-gesture audio; decodes on demand, caches, applies volume and closes on destroy', async () => {
      await page.evaluate(() => {
        window.audioLog = [];
        window.audioGains = [];
        class MockContext {
          destination = {};
          createGain() {
            return {
              gain: {
                get value() {
                  return 1;
                },
                set value(v: number) {
                  window.audioGains.push(v);
                },
              },
              connect() {},
              disconnect() {},
            };
          }
          async resume() {
            window.audioLog.push('resume');
          }
          async close() {
            window.audioLog.push('close');
          }
          async decodeAudioData() {
            window.audioLog.push('decode');
            return {};
          }
          createBufferSource() {
            return {
              connect() {},
              disconnect() {},
              start() {
                window.audioLog.push('start');
              },
              stop() {
                window.audioLog.push('stop');
              },
            };
          }
        }
        Object.defineProperty(window, 'AudioContext', { value: MockContext });
        Object.defineProperty(navigator, 'userActivation', {
          configurable: true,
          value: { hasBeenActive: false },
        });
        const i = window.eventIcon;
        i.player!.model.doc.assets = {
          tone: { type: 'audio', source: 'data:audio/wav;base64,AA==' },
        };
        i.player!.model.doc.audioVolumes = { tone: 0.3 };
        const hook = (customElements.get('anima-icon') as typeof AnimaIcon).eventHook!;
        hook(i, 'event', { name: 'sound', time: 0, layer: null, audio: 'tone', volume: 0.5 });
      });
      expect(await page.evaluate(() => window.audioLog)).toEqual([]);
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'userActivation', { value: { hasBeenActive: true } });
        window.eventIcon.volume = 0.2;
        (customElements.get('anima-icon') as typeof AnimaIcon).eventHook!(
          window.eventIcon,
          'event',
          { name: 'sound', time: 0, layer: null, audio: 'tone', volume: 0.5 },
        );
      });
      await page.waitForFunction(() => window.audioLog.includes('start'));
      await page.evaluate(() => {
        (customElements.get('anima-icon') as typeof AnimaIcon).eventHook!(
          window.eventIcon,
          'event',
          { name: 'sound', time: 0, layer: null, audio: 'tone' },
        );
      });
      await page.waitForFunction(() => window.audioLog.filter((s) => s === 'start').length === 2);
      expect(
        await page.evaluate(() => {
          window.eventIcon.volume = 0.7;
          return window.audioGains;
        }),
      ).toEqual([0.2, 0.15, 0.3, 0.7]);
      expect(
        await page.evaluate(() => {
          try {
            window.eventIcon.volume = NaN;
            return false;
          } catch (e) {
            return e instanceof RangeError;
          }
        }),
      ).toBe(true);
      const result = await page.evaluate(() => {
        window.eventIcon.destroy();
        return window.audioLog;
      });
      expect(result.filter((s) => s === 'decode')).toHaveLength(1);
      expect(result).toContain('close');
      expect(result.filter((s) => s === 'stop')).toHaveLength(2);
    });
    it('reports decode failures with a diagnostic and permits retry', async () => {
      await page.evaluate(() => {
        window.observed = [];
        const i = window.eventIcon;
        i.player!.model.doc.assets = {
          tone: { type: 'audio', source: 'data:audio/wav;base64,AA==' },
        };
        i.assets = async () => new Blob([new Uint8Array([0])]);
        i.on('error', (e) => window.observed.push(JSON.stringify(e.detail)));
        Object.defineProperty(navigator, 'userActivation', { value: { hasBeenActive: true } });
        class FailContext {
          destination = {};
          createGain() {
            return { gain: { value: 1 }, connect() {} };
          }
          async resume() {}
          async close() {}
          async decodeAudioData() {
            throw Error('invalid');
          }
        }
        Object.defineProperty(window, 'AudioContext', { value: FailContext });
        (customElements.get('anima-icon') as typeof AnimaIcon).eventHook!(i, 'event', {
          name: 'x',
          time: 0,
          layer: null,
          audio: 'tone',
        });
      });
      await page.waitForFunction(() => window.observed.length === 1);
      expect(JSON.parse((await page.evaluate(() => window.observed))[0]!)).toEqual([
        expect.objectContaining({
          code: 'event-audio-load',
          pointer: '/assets/tone/source',
          message: expect.any(String),
          hint: expect.any(String),
        }),
      ]);
      await page.evaluate(() => {
        (customElements.get('anima-icon') as typeof AnimaIcon).eventHook!(
          window.eventIcon,
          'event',
          { name: 'x', time: 0, layer: null, audio: 'tone' },
        );
      });
      await page.waitForFunction(() => window.observed.length === 2);
    });
    it('allows same-origin relative URLs and keeps a policy callback from mutating the destination', async () => {
      const result = await page.evaluate(() => {
        const base = document.createElement('base');
        base.href = 'https://host.test/sub/';
        document.head.append(base);
        const i = window.eventIcon;
        i.urlPolicy = (url) => {
          url.href = 'javascript:alert(1)';
          return true;
        };
        const hook = (customElements.get('anima-icon') as typeof AnimaIcon).eventHook!;
        for (const url of ['/path', 'relative', '//host.test/same', '//evil.test/path'])
          hook(i, 'event', { name: 'x', time: 0, layer: null, url, target: '_self' });
        return window.opened;
      });
      expect(result).toEqual([
        ['https://host.test/path', '_self', 'noopener'],
        ['https://host.test/sub/relative', '_self', 'noopener'],
        ['https://host.test/same', '_self', 'noopener'],
      ]);
    });
    it('invalidates a pending decode on disconnect, including the captured custom-element lifecycle callback', async () => {
      await page.evaluate(() => {
        window.audioLog = [];
        const i = window.eventIcon;
        i.player!.model.doc.assets = { tone: { type: 'audio', source: 'unused' } };
        i.assets = async () => new Blob([new Uint8Array([0])]);
        Object.defineProperty(navigator, 'userActivation', { value: { hasBeenActive: true } });
        class PendingContext {
          destination = {};
          createGain() {
            return { gain: { value: 1 }, connect() {} };
          }
          async resume() {}
          async close() {
            window.audioLog.push('close');
          }
          async decodeAudioData() {
            window.audioLog.push('decode');
            await new Promise((res) => {
              window.finishDecode = () => res({});
            });
            return {};
          }
          createBufferSource() {
            window.audioLog.push('source');
            return {};
          }
        }
        Object.defineProperty(window, 'AudioContext', { value: PendingContext });
        (customElements.get('anima-icon') as typeof AnimaIcon).eventHook!(i, 'event', {
          name: 'x',
          time: 0,
          layer: null,
          audio: 'tone',
        });
      });
      await page.waitForFunction(() => window.audioLog.includes('decode'));
      await page.evaluate(async () => {
        window.eventIcon.remove();
        window.finishDecode();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(await page.evaluate(() => window.audioLog)).toEqual(['decode', 'close']);
    });
    it('plays a bubbled component audio event using its owning asset, resolver scope and resource gain', async () => {
      await page.addScriptTag({ type: 'module', content: assets });
      await page.addScriptTag({ type: 'module', content: components });
      await page.waitForFunction(() =>
        (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('components'),
      );
      await page.evaluate(() => {
        window.audioLog = [];
        window.audioGains = [];
        Object.defineProperty(navigator, 'userActivation', { value: { hasBeenActive: true } });
        class MockContext {
          destination = {};
          createGain() {
            return {
              gain: {
                get value() {
                  return 1;
                },
                set value(v: number) {
                  window.audioGains.push(v);
                },
              },
              connect() {},
              disconnect() {},
            };
          }
          async resume() {}
          async close() {}
          async decodeAudioData() {
            return {};
          }
          createBufferSource() {
            return {
              connect() {},
              start() {
                window.audioLog.push('start');
              },
              stop() {},
            };
          }
        }
        Object.defineProperty(window, 'AudioContext', { value: MockContext });
        const i = window.eventIcon;
        i.assets = async (name) => {
          window.audioLog.push(name);
          return new Blob([new Uint8Array([0])]);
        };
        const result = i.load({
          anima: '0.1',
          name: 'nested',
          grid: 20,
          requires: ['events', 'assets', 'components'],
          components: {
            child: {
              grid: 20,
              assets: { tone: { type: 'audio', source: 'unused' } },
              audioVolumes: { tone: 0.3 },
              eventDefs: { ping: { audio: 'tone', volume: 0.5 } },
              nodes: [
                { id: 'dot', type: 'circle', center: [10, 10], r: 1, fill: { color: '#000' } },
              ],
              machine: {
                layers: { l: { initial: 's', states: { s: { pose: {}, emit: 'ping' } } } },
              },
            },
          },
          nodes: [{ id: 'child', type: 'instance', component: 'child' }],
        });
        if (result.length) throw Error(JSON.stringify(result));
        i.play();
      });
      await page.waitForFunction(() => window.audioLog.includes('start'));
      expect(await page.evaluate(() => window.audioLog)).toEqual(['child.tone', 'start']);
      expect(await page.evaluate(() => window.audioGains)).toEqual([1, 0.15]);
    });
  });
