import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
function doc(
  write: unknown = {
    'pointer-x': '$x',
    'pointer-y': '$y',
    'pointer-delta-x': '$dx',
    'pointer-delta-y': '$dy',
  },
  value?: string,
) {
  return {
    anima: '0.1',
    name: 'write-data',
    grid: 20,
    requires: ['input', 'data'],
    data: {
      models: {
        Root: {
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            dx: { type: 'number' },
            dy: { type: 'number' },
            key: { type: 'string' },
          },
        },
      },
    },
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 8 }],
    listeners: [
      { on: 'move', write, ...(value ? { value } : {}) },
      { on: 'key-down', write: { 'key-pressed': '$key' } },
    ],
  };
}
it('writes grid coordinates, per-event deltas and key names into typed data, in both syntaxes', () => {
  for (const raw of [doc(), compile(decompile(doc())).doc!]) {
    const r = load(raw);
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const p = new Player(r.model!);
    p.pointer('move', 10, 11);
    p.step(0);
    expect([p.get('$x'), p.get('$y'), p.get('$dx'), p.get('$dy')]).toEqual([10, 11, 0, 0]);
    p.pointer('move', 12, 8);
    p.step(0);
    expect([p.get('$x'), p.get('$y'), p.get('$dx'), p.get('$dy')]).toEqual([12, 8, 2, -3]);
    p.pointer('move', 11, 9);
    p.step(0);
    expect([p.get('$dx'), p.get('$dy')]).toEqual([-1, 1]);
    p.input().key('down', 'Escape');
    p.step(0);
    expect(p.get('$key')).toBe('Escape');
    p.input().key('up', 'x');
    p.step(0);
    expect(p.get('$key')).toBe('Escape');
  }
});
it('supports the scalar write/value spelling in JSON and AniML', () => {
  for (const raw of [doc('$x', 'pointer-x'), compile(decompile(doc('$x', 'pointer-x'))).doc!]) {
    const r = load(raw);
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const p = new Player(r.model!);
    p.pointer('move', 7, 8);
    p.step(0);
    expect(p.get('$x')).toBe(7);
  }
});
it.each([
  ['pointer-x', '$key'],
  ['key-pressed', '$x'],
  ['pointer-delta-x', '$key'],
  ['unknown', '$x'],
])('diagnoses mismatched or unknown write source %s', (field, target) => {
  const r = load(doc({ [field]: target }));
  expect(r.model).toBeUndefined();
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'input-write',
      pointer: '/listeners/0/write/' + field,
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});
