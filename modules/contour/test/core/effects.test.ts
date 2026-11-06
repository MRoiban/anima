import '@anima-format/core/all';
import { it, expect } from 'vitest';
import { load, Player, drawFrame, toSVG } from '@anima-format/core';
import { applyEffects, type Effect } from '../../core/effects.ts';
const d = 'M0 0L10 0M0 10L30 10';
it('trims sequentially over the combined length and synchronously per contour', () => {
  expect(applyEffects(d, [{ type: 'trim', start: 0, end: 0.5 }])).toBe('M0 0L10 0M0 10L10 10');
  expect(applyEffects(d, [{ type: 'trim', start: 0, end: 0.5, mode: 'synchronized' }])).toBe(
    'M0 0L5 0M0 10L15 10',
  );
  expect(applyEffects(d, [{ type: 'trim', start: 0.75, end: 1, offset: 0.125 }])).toBe(
    'M0 0L5 0M25 10L30 10',
  );
});
it('applies stacks in authored order, including dash phase and odd patterns', () => {
  const trim: Effect = { type: 'trim', start: 0.2, end: 0.8 },
    dash: Effect = { type: 'dash', dash: [2, 2] };
  expect(applyEffects('M0 0L10 0', [trim, dash])).toBe('M2 0L4 0M6 0L8 0');
  expect(applyEffects('M0 0L10 0', [dash, trim])).toBe('M1.2 0L2 0M4 0L6 0M8 0L8.8 0');
  expect(applyEffects('M0 0L10 0', [{ type: 'dash', dash: [2], offset: 1 }])).toBe(
    'M0 0L1 0M3 0L5 0M7 0L9 0',
  );
});
const doc = (stroke: object, effects?: object) => ({
  anima: '0.1',
  name: 'effects',
  grid: 20,
  requires: ['contour', 'paint'],
  ...(effects ? { effects } : {}),
  nodes: [
    { id: 'a', type: 'path', d, fill: { color: '#f00' }, stroke: { color: '#000', ...stroke } },
  ],
});
it('resolves a shared stack into independent stroke geometry without changing fill or hit outline', () => {
  const r = load(doc({ effects: ['half'] }, { half: [{ type: 'trim', end: 0.5 }] }));
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!),
    f = drawFrame(p);
  expect(f.nodes[0]!.geometry!.d).toBe(d);
  expect(f.nodes[0]!.paints.find((p) => p.kind === 'stroke')!.geometry!.d).toBe(
    'M0 0L10 0M0 10L10 10',
  );
  expect(toSVG(p)).toContain('d="M0 0L10 0M0 10L10 10"');
  expect(toSVG(p)).toContain(`d="${d}"`);
});
it.each([
  [{ effects: ['missing'] }, undefined, 'unknown-source', '/nodes/0/stroke/effects/0'],
  [
    { effects: [{ type: 'dash', dash: [0, 0] }] },
    undefined,
    'bad-value',
    '/nodes/0/stroke/effects/0/dash',
  ],
  [
    { effects: [{ type: 'trim', dash: [1] }] },
    undefined,
    'bad-value',
    '/nodes/0/stroke/effects/0/dash',
  ],
  [{ effects: [], trim: { end: 0.5 } }, undefined, 'paint-conflict', '/nodes/0/stroke/effects'],
  [{ trim: { end: 0.5 }, dash: [1] }, undefined, 'paint-conflict', '/nodes/0/stroke'],
] as const)('rejects ambiguous and invalid effect inputs', (stroke, shared, code, pointer) => {
  const r = load(doc(stroke, shared));
  expect(r.model).toBeUndefined();
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({
      code,
      pointer,
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});
