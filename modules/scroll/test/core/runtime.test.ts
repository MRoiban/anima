import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';

const make = (offsetY = 0, extra: object = {}) => {
  const result = load({
    anima: '0.1',
    name: 'scroll-runtime',
    grid: 20,
    requires: ['rig', 'input', 'scroll'],
    nodes: [
      { id: 'viewport', type: 'rect', x0: 0, y0: 0, w: 10, h: 10 },
      {
        id: 'content',
        type: 'group',
        constraints: [{ kind: 'scroll', viewport: 'viewport', axis: 'y', offsetY }],
        children: [{ id: 'body', type: 'rect', x0: 0, y0: 0, w: 10, h: 30 }],
      },
    ],
    ...extra,
  });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(result.model!);
};

it('clamps authored offsets and publishes scroll percentages', () => {
  const p = make(99);
  expect(p.values()['content.world.y']).toBe(-20);
  expect(p.values()['content.constraints.0.percentY']).toBe(1);
});

it('lets a bound offset override player-local scroll state each step', () => {
  const p = make(0, {
    requires: ['rig', 'input', 'scroll', 'bind'],
    inputs: { y: { type: 'number', default: 4 } },
    bind: { 'content.constraints.0.offsetY': 'y' },
  });
  p.step(0);
  expect(p.values()['content.world.y']).toBe(-4);
  p.set('y', 8);
  p.step(0);
  expect(p.values()['content.world.y']).toBe(-8);
});

it('keeps drag scrolling when only a dormant timeline could drive the offset', () => {
  const p = make(0, {
    timelines: {
      dormant: {
        duration: 1,
        tracks: {
          'content.constraints.0.offsetY': [
            [0, 0],
            [1, 5],
          ],
        },
      },
    },
  });
  const input = p.input();
  p.step(0);
  input.pointer('down', 5, 1, { id: 7 });
  input.pointer('move', 5, 6, { id: 7 });
  p.step(0);
  expect(p.values()['content.world.y']).toBe(-5);
});

it('links and resizes a vertical thumb from the scroll percentage', () => {
  const result = load({
    anima: '0.1',
    name: 'scroll-thumb',
    grid: 40,
    requires: ['rig', 'input', 'scroll'],
    nodes: [
      { id: 'viewport', type: 'rect', x0: 0, y0: 0, w: 10, h: 10 },
      {
        id: 'content',
        type: 'group',
        constraints: [{ kind: 'scroll', viewport: 'viewport', axis: 'y', offsetY: 10 }],
        children: [{ id: 'body', type: 'rect', x0: 0, y0: 0, w: 10, h: 30 }],
      },
      { id: 'track', type: 'rect', x0: 12, y0: 0, w: 2, h: 12 },
      {
        id: 'thumb',
        type: 'rect',
        x0: 12,
        y0: 0,
        w: 2,
        h: 2,
        constraints: [
          { kind: 'scrollThumb', scroll: 'content', track: 'track', axis: 'y', resize: true },
        ],
      },
    ],
  });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(result.model!),
    values = p.values();
  expect(values['content.constraints.0.percentY']).toBe(0.5);
  expect(values['thumb.world.y']).toBeCloseTo(4, 8);
  const m = p.world(result.model!.ids.get('thumb')!);
  expect(Math.hypot(m[2], m[3])).toBeCloseTo(2, 8);
});

it('queues viewport drag and wheel offsets until step 1 and clamps them', () => {
  const p = make();
  const input = p.input();
  input.pointer('down', 5, 1, { id: 7 });
  input.pointer('move', 5, 5, { id: 7 });
  expect(p.values()['content.world.y']).toBe(0);
  p.step(0);
  expect(p.values()['content.world.y']).toBe(-4);
  expect(input.scroll(5, 5, 0, 50)).toBe(true);
  p.step(0);
  expect(p.values()['content.world.y']).toBe(-20);
  expect(input.scroll(5, 5, 0, 1)).toBe(false);
});

it('thumb drag sets the linked scroll offset and remains settled', () => {
  const result = load({
    anima: '0.1',
    name: 'thumb-drag',
    grid: 40,
    requires: ['rig', 'input', 'scroll'],
    nodes: [
      { id: 'viewport', type: 'rect', x0: 0, y0: 0, w: 10, h: 10 },
      {
        id: 'content',
        type: 'group',
        constraints: [{ kind: 'scroll', viewport: 'viewport', axis: 'y' }],
        children: [{ id: 'body', type: 'rect', x0: 0, y0: 0, w: 10, h: 30 }],
      },
      { id: 'track', type: 'rect', x0: 12, y0: 0, w: 2, h: 12 },
      {
        id: 'thumb',
        type: 'rect',
        x0: 12,
        y0: 0,
        w: 2,
        h: 2,
        constraints: [
          { kind: 'scrollThumb', scroll: 'content', track: 'track', axis: 'y', resize: true },
        ],
      },
    ],
  });
  const p = new Player(result.model!),
    input = p.input();
  input.pointer('down', 13, 1, { id: 2 });
  input.pointer('move', 13, 5, { id: 2 });
  const step = p.step(0);
  expect(p.values()['content.constraints.0.percentY']).toBeCloseTo(0.5, 8);
  expect(step.settled).toBe(true);
});
