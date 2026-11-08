import '@anima-format/core/all';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { expect, it } from 'vitest';
import { buildPlayground } from '../../../tools/build-playground.ts';
import { load, Player } from '@anima-format/core';
import { sampleTimeline } from '../src/pure.ts';

// Rottweiler P3 R1-06: scrubbing a timeline with data-bound keyframes reads the live player.
it('samples data-bound keyframes through the live player', () => {
  const { model } = load(
    readFileSync(
      new URL('../../../spec/conformance/data-bind-keyframes/case.ani', import.meta.url),
      'utf8',
    ),
  );
  const player = new Player(model!);
  const doc = sampleTimeline(model!, model!.timelines[0]!, 0.5, player) as {
    machine: { layers: { scrub: { states: { sample: { pose: Record<string, unknown> } } } } };
  };
  const pose = doc.machine.layers.scrub.states.sample.pose;
  const track = model!.timelines[0]!.tracks[0]!;
  expect(typeof pose[track.addr]).toBe('number');
  expect(Number.isFinite(pose[track.addr])).toBe(true);
});

// Rottweiler P3 R4-04: post-state bindings do not override the sampled timeline.
it('keeps the sampled timeline over a bound address', () => {
  const { model } = load({
    anima: '0.1',
    name: 'bound-scrub',
    grid: 20,
    requires: ['bind'],
    inputs: { position: { type: 'number', default: 3 } },
    nodes: [{ id: 'dot', type: 'circle', center: [0, 0], r: 1, fill: { color: '#000' } }],
    bind: { 'dot.x': 'position' },
    timelines: {
      t: {
        duration: 1,
        tracks: {
          'dot.x': [
            [0, 0],
            [1, 10],
          ],
        },
      },
    },
  });
  const sample = load(sampleTimeline(model!, model!.timelines[0]!, 0.5));
  expect(sample.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(sample.model!);
  p.step(0);
  expect(p.value('dot.x')).toBe(5);
});

// Rottweiler P3 R4-05: a poll answered after a save completed does not report a conflict.
const chromiumPath = resolve(
  homedir(),
  '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
);
it.skipIf(!existsSync(chromiumPath))(
  'ignores a stale file poll that resolves after a save',
  async () => {
    const html = await buildPlayground();
    const text =
      '<anima version="0.1" name="test" grid="20"><circle id="dot" cx="1" cy="1" r="1" fill="#000"/></anima>';
    const browser = await chromium.launch({ executablePath: chromiumPath });
    try {
      const page = await browser.newPage();
      let revision = 'a',
        hold = false,
        held!: () => void,
        release!: () => void;
      const holding = new Promise<void>((r) => (held = r));
      await page.route('http://localhost/**', async (route) => {
        const request = route.request();
        if (request.url().endsWith('/api/file')) {
          if (request.method() === 'PUT') {
            revision = 'b';
            await route.fulfill({ json: { revision } });
            return;
          }
          const data = { source: text, revision, writable: true, name: 'scratch.animl' };
          if (hold) {
            hold = false;
            held();
            await new Promise<void>((r) => (release = r));
          }
          await route.fulfill({ json: data });
          return;
        }
        await route.fulfill({ contentType: 'text/html', body: html });
      });
      await page.goto('http://localhost/');
      await page.waitForFunction(
        () => (document.querySelector('#icon') as { player?: unknown } | null)?.player,
      );
      hold = true;
      await holding;
      await page.locator('#source').fill(text + '\n<!--edit-->');
      await page.locator('#save').click();
      await page.waitForFunction(() => document.querySelector('#saved')?.textContent === 'saved');
      release();
      // The held answer (revision a) arrives after the save moved the revision to b.
      await page.waitForTimeout(300);
      expect(await page.locator('#reload').isVisible()).toBe(false);
      expect(await page.locator('#save').isDisabled()).toBe(false);
    } finally {
      await browser.close();
    }
  },
  30_000,
);
