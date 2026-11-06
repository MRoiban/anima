import '@anima-format/core/all';
import { it, expect } from 'vitest';
import { load, Player, drawFrame, toSVG } from '@anima-format/core';
import { compile, decompile } from '@anima-format/markup';
const doc = (fill: object) => ({
  anima: '0.1',
  name: 'gradient',
  grid: 20,
  requires: ['paint'],
  nodes: [{ id: 'a', type: 'rect', x0: 0, y0: 0, w: 20, h: 20, fill }],
});
const gradient = {
  type: 'linear',
  x1: 0,
  y1: 0,
  x2: 20,
  y2: 0,
  stops: [
    { position: 0, color: '#f00' },
    { position: 1, color: '#00f' },
  ],
};
it('keeps an affine gradient matrix separate from geometry and round trips it', () => {
  const document = doc({ ...gradient, gradientTransform: [0, 1, -1, 0, 20, 0] });
  const r = load(document);
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  const f = drawFrame(p);
  expect(f.nodes[0]!.paints[0]!.gradientTransform).toEqual([0, 1, -1, 0, 20, 0]);
  expect(f.nodes[0]!.transform).toEqual([1, 0, -0, 1, 0, 0]);
  expect(toSVG(p)).toContain('gradientTransform="matrix(0 1 -1 0 20 0)"');
  expect(compile(decompile(document)).doc).toEqual(document);
});
it('accepts angular endpoints and refuses SVG with an actionable diagnostic', () => {
  const document = doc({ ...gradient, type: 'angular' });
  const r = load(document);
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  expect(drawFrame(p).nodes[0]!.paints[0]!.type).toBe('angular');
  try {
    toSVG(p);
    throw Error('expected refusal');
  } catch (e) {
    expect(e).toMatchObject({
      code: 'unsupported-render',
      pointer: '/nodes/0/fill/type',
      message: expect.stringContaining('angular'),
      hint: expect.stringContaining('canvas'),
    });
  }
  expect(compile(decompile(document)).doc).toEqual(document);
});
it('rejects singular gradient transforms at the exact field', () => {
  const r = load(doc({ ...gradient, gradientTransform: [1, 2, 2, 4, 0, 0] }));
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'bad-value',
      pointer: '/nodes/0/fill/gradientTransform',
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});
it('reports the authored pointer for an unsupported nested gradient', () => {
  const document = doc({ ...gradient, type: 'angular' });
  const nested = { ...document, nodes: [{ id: 'g', type: 'group', children: document.nodes }] };
  const r = load(nested);
  expect(r.diagnostics).toEqual([]);
  expect(() => toSVG(new Player(r.model!))).toThrowError(
    expect.objectContaining({
      code: 'unsupported-render',
      pointer: '/nodes/0/children/0/fill/type',
    }),
  );
});
