import '@anima-format/core/all';
import { describe, expect, it } from 'vitest';
import { load, Player, toSVG, sceneOrder } from '../src/index.ts';
import { compile, decompile } from '../../markup/src/index.ts';
import { readFileSync } from 'node:fs';
const rect = (id: string, extra: object = {}) => ({
  id,
  type: 'rect',
  x0: 0,
  y0: 0,
  w: 20,
  h: 20,
  fill: { color: '#f00' },
  ...extra,
});
const doc = (nodes: object[]) => ({
  anima: '0.1',
  name: 'composite',
  grid: 20,
  requires: ['composite'],
  nodes,
});
describe('composite paint', () => {
  it('round trips group clips with an optional default rule', () => {
    const source = doc([
      { id: 'g', type: 'group', clip: { source: 'b' }, children: [rect('a')] },
      rect('b', { w: 10, visible: false }),
    ]);
    const result = compile(decompile(source));
    expect(result.diagnostics).toEqual([]);
    expect(result.doc).toEqual(source);
    const svg = toSVG(new Player(load(source).model!));
    expect(svg).toContain('clip-rule="nonzero"');
  });
  it.each([
    [{}, 'missing-key', '/nodes/0/clip'],
    [{ source: 'b', rule: 'bad' }, 'bad-value', '/nodes/0/clip/rule'],
    [{ source: 'missing' }, 'unknown-source', '/nodes/0/clip/source'],
  ])('diagnoses invalid group clips %j', (clip, code, pointer) => {
    const source = doc([{ id: 'g', type: 'group', clip, children: [rect('a')] }, rect('b')]);
    expect(load(source).diagnostics).toContainEqual(expect.objectContaining({ code, pointer }));
    const result = compile(decompile(source));
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: code === 'missing-key' ? 'missing-attribute' : code,
        pointer: code === 'missing-key' ? '/nodes/0/clip' : pointer,
        line: expect.any(Number),
        column: expect.any(Number),
      }),
    );
  });
  it.each([
    [
      'unknown-source',
      [rect('a', { mask: { source: 'missing', mode: 'alpha', sourceDraws: false } })],
      '/nodes/0/mask/source',
    ],
    [
      'self-reference',
      [rect('a', { mask: { source: 'a', mode: 'alpha', sourceDraws: false } })],
      '/nodes/0/mask',
    ],
    [
      'reference-cycle',
      [
        rect('a', { mask: { source: 'b', mode: 'alpha', sourceDraws: false } }),
        rect('b', { mask: { source: 'a', mode: 'alpha', sourceDraws: false } }),
      ],
      '/nodes/0/mask',
    ],
    [
      'clip-source-not-painted',
      [
        rect('a', { clip: { source: 'g', rule: 'nonzero' } }),
        { id: 'g', type: 'group', children: [] },
      ],
      '/nodes/0/clip/source',
    ],
    [
      'bad-draw-target',
      [
        rect('a', { drawOrder: { target: 'b', position: 'after' } }),
        { id: 'g', type: 'group', children: [rect('b')] },
      ],
      '/nodes/0/drawOrder',
    ],
    ['paint-conflict', [rect('a', { paints: [{ fill: { color: '#000' } }] })], '/nodes/0/paints'],
    ['paint-conflict', [rect('a', { fill: undefined, paints: [{}] })], '/nodes/0/paints/0'],
  ] as [string, object[], string][])('%s', (code, nodes, pointer) => {
    const result = load(JSON.stringify(doc(nodes)));
    expect(result.model).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        pointer,
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
  });
  it('shares source definitions without duplicate ids in chained masks', () => {
    const source = doc([
      rect('a', { mask: { source: 'b', mode: 'alpha', sourceDraws: false } }),
      rect('b', { mask: { source: 'c', mode: 'alpha', sourceDraws: false } }),
      rect('c'),
    ]);
    const loaded = load(JSON.stringify(source));
    expect(loaded.diagnostics).toEqual([]);
    const svg = toSVG(new Player(loaded.model!));
    const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('retains ordered paint children through markup round trips', () => {
    const source = readFileSync(
      new URL('../../../spec/conformance/paint-paints/case.animl', import.meta.url),
      'utf8',
    );
    const built = compile(source);
    expect(built.diagnostics).toEqual([]);
    expect(compile(decompile(built.text!)).text).toBe(built.text);
  });
  it('samples paint visibility and draw order, and serializes the sampled order', () => {
    const source = readFileSync(
      new URL('../../../spec/conformance/paint-draw-order/case.ani', import.meta.url),
      'utf8',
    );
    const p = new Player(load(source).model!);
    expect(sceneOrder(p, [0, 1])).toEqual([1, 0]);
    expect(toSVG(p).indexOf('fill="#00f"')).toBeLessThan(toSVG(p).indexOf('fill="#f00"'));
    p.step(1);
    expect(sceneOrder(p, [0, 1])).toEqual([0, 1]);
    expect(toSVG(p).indexOf('fill="#f00"')).toBeLessThan(toSVG(p).indexOf('fill="#00f"'));
  });
});
