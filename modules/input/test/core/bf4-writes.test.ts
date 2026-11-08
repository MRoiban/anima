import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
const raw = JSON.parse(
  readFileSync(new URL('../fixtures/bf4-writes.json', import.meta.url), 'utf8'),
);
it('B19: listener set/copy and input write-* update plain, twice-nested and repeated data paths in both syntaxes', () => {
  for (const doc of [raw, compile(decompile(raw)).doc!]) {
    const r = load(doc);
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const p = new Player(r.model!);
    p.step(0);
    for (const [offset, path, target] of [
      [0, '', 'pad'],
      [20, 'child.leaf.', 'outer.inner.pad'],
      [40, 'rows.0.', 'rows.0.pad'],
      [60, 'rows.1.', 'rows.1.pad'],
    ] as const) {
      p.pointer('move', offset + 5, 5);
      p.step(0);
      p.pointer('move', offset + 8, 7);
      p.step(0);
      expect(
        ['x', 'y', 'dx', 'dy'].map((k) => p.get('$' + path + k)),
        path,
      ).toEqual([8, 7, 3, 2]);
      p.pointer('down', offset + 8, 7);
      p.pointer('up', offset + 8, 7);
      p.step(0);
      expect(p.get('$' + path + 'n')).toBe(7);
      // Copy runs before click's set; repeat with the committed source.
      p.pointer('down', offset + 8, 7);
      p.pointer('up', offset + 8, 7);
      p.step(0);
      expect(p.get('$' + path + 'copy')).toBe(7);
      p.focusTarget(target);
      p.input().key('down', 'Escape');
      p.step(0);
      expect(p.get('$' + path + 'key')).toBe('Escape');
    }
  }
});
