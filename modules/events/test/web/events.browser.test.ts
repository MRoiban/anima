import { existsSync } from 'node:fs';
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
    beforeAll(async () => {
      [base, events, assets, components] = await Promise.all(
        ['index', 'events', 'assets', 'components'].map((n) =>
          bundle(new URL(`../../../../packages/web/src/${n}.ts`, import.meta.url).pathname),
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
