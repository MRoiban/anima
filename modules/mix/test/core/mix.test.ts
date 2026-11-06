import '@anima-format/core/all';
import { it, expect } from 'vitest';
import { load, Player, drawFrame, toSVG } from '@anima-format/core';
import { compile, decompile } from '@anima-format/markup';
const doc = (node: object) => ({
  anima: '0.1',
  name: 'mix',
  grid: 20,
  requires: ['mix', 'composite'],
  nodes: [
    { id: 'a', type: 'rect', x0: 2, y0: 2, w: 16, h: 16, fill: { color: '#4263eb' }, ...node },
  ],
});
it('resolves additive strength and refuses SVG explicitly', () => {
  const document = doc({ mix: { mode: 'additive', strength: 0.5 } });
  const r = load(document);
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  expect(drawFrame(p).nodes[0]).toMatchObject({ blend: 'additive', blendAmount: 0.5 });
  expect(() => toSVG(p)).toThrowError(
    expect.objectContaining({
      code: 'unsupported-render',
      pointer: '/nodes/0/mix',
      hint: expect.stringContaining('canvas'),
    }),
  );
  expect(compile(decompile(document)).doc).toEqual(document);
});
it('moves node blend to each paint when one paint overrides it', () => {
  const document = doc({
    fill: undefined,
    blend: 'multiply',
    paints: [
      { fill: { color: '#4263eb', blend: 'screen' } },
      { stroke: { color: '#d97757', blend: 'inherit' } },
    ],
  });
  Reflect.deleteProperty(document.nodes[0]!, 'fill');
  const r = load(document);
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!),
    n = drawFrame(p).nodes[0]!;
  expect(n.blend).toBe('normal');
  expect(n.paints.map((p) => p.blend)).toEqual(['screen', 'multiply']);
  expect(() => toSVG(p)).toThrowError(
    expect.objectContaining({
      code: 'unsupported-render',
      message: expect.stringContaining('per-paint'),
      pointer: '/nodes/0/paints/0/fill/blend',
      hint: expect.stringContaining('canvas'),
    }),
  );
  expect(compile(decompile(document)).doc).toEqual(document);
});
it('rejects competing node blend declarations', () => {
  const r = load(doc({ blend: 'screen', mix: { mode: 'additive' } }));
  expect(r.model).toBeUndefined();
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'paint-conflict',
      pointer: '/nodes/0/mix',
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});
