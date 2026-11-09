import '@anima-format/core/all';
import { describe, it, expect } from 'vitest';
import { load, jsonSchema } from '@anima-format/core';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run as cli } from '../../../../packages/cli/src/cli.ts';
const document = (nodes: object[]) => ({
  anima: '0.1',
  name: 'rig-invalid',
  grid: 20,
  requires: ['rig', 'layout'],
  nodes,
});
const group = (id: string, extra: object = {}) => ({ id, type: 'group', ...extra });
const bone = (id: string, extra: object = {}) => ({ id, type: 'bone', length: 2, ...extra });
const copy = (id: string) => ({ kind: 'copyPosition', from: id });
const broken: [string, object[], string][] = [
  [
    'rig-cycle',
    [group('a', { constraints: [copy('b')] }), group('b', { constraints: [copy('a')] })],
    '/nodes/1/constraints/0',
  ],
  ['rig-target', [group('a', { constraints: [copy('missing')] })], '/nodes/0/constraints/0'],
  ['rig-bone-offset', [bone('a', { children: [bone('b', { x: 0 })] })], '/nodes/0/children/0/x'],
  ['rig-bone-parent', [{ id: 'a', type: 'layout', children: [bone('b')] }], '/nodes/0/children/0'],
  ['rig-bone-pivot', [bone('a', { pivot: [0, 0] })], '/nodes/0/pivot'],
];
describe('rig diagnostics', () => {
  for (const [code, nodes, pointer] of broken)
    it(code, () => {
      const r = load(document(nodes));
      if (code === 'rig-bone-parent')
        expect(r.diagnostics.find((d) => d.code === code)?.hint).toBe(
          'wrap the bones in a <group>',
        );
      expect(r.model).toBeUndefined();
      expect(r.diagnostics).toContainEqual(
        expect.objectContaining({
          code,
          pointer,
          severity: 'error',
          message: expect.any(String),
          hint: expect.any(String),
        }),
      );
    });
  it('validates exact kind fields, required fields, nonnegative distance and strength range', () => {
    for (const raw of [
      null,
      { kind: 'copyPosition', distance: 1 },
      { kind: 'keepDistance', to: 'b' },
      { kind: 'keepDistance', to: 'b', distance: -1 },
      { kind: 'copyPosition', strength: 2 },
    ])
      expect(
        load(document([group('a', { constraints: [raw] }), group('b')])).model,
      ).toBeUndefined();
  });
  it('rejects out-of-range constraint addresses without throwing', () => {
    const raw = {
      ...document([group('a')]),
      timelines: { go: { duration: 1, tracks: { 'a.constraints.9.strength': [[0, 1]] } } },
    };
    expect(() => load(raw)).not.toThrow();
    expect(load(raw).model).toBeUndefined();
  });
  it('exposes exact constraint alternatives in generated JSON Schema', () => {
    const text = JSON.stringify(jsonSchema());
    expect(text).toContain('keepDistance');
    expect(text).toContain('copyRotation');
    expect(text).toContain('factorX');
  });
  it('CLI validation prints code, pointer, message and hint; schema lists every kind', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'anima-rig-diag-'));
    try {
      for (const [code, nodes, pointer] of broken) {
        const file = join(dir, 'bad.ani');
        writeFileSync(file, JSON.stringify(document(nodes)));
        let output = '';
        const exit = await cli(['validate', file], {
          out: (s) => (output += s),
          err: (s) => (output += s),
        });
        expect(exit).not.toBe(0);
        expect(output).toContain(code);
        expect(output).toContain(pointer);
        expect(output).toMatch(/remove|target|existing|wrap the bones in a <group>/);
      }
      for (const kind of [
        'bone',
        'copyPosition',
        'copyRotation',
        'copyScale',
        'copyTransform',
        'keepDistance',
      ]) {
        let out = '';
        expect(
          await cli(['schema', kind], { out: (s) => (out += s), err: (s) => (out += s) }),
        ).toBe(0);
        expect(out).toMatch(/length|strength/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
