import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import '@anima-format/core/all';
import { load, runScript } from '@anima-format/core';
import { compile, decompile } from '@anima-format/markup';
import type { SemanticNode } from '../../core/types.ts';

// Module-owned conformance case: explicit independent tree/focus expectations.
const source = readFileSync(
  new URL('../../../a11y-dom/examples/navigation.animl', import.meta.url),
  'utf8',
);
const signature = (nodes: SemanticNode[]): unknown[] =>
  nodes.map((n) => [n.id, n.role, n.actions, signature(n.children)]);
describe('A11Y issue #34 conformance', () => {
  it('supports toolbar, grid, row and gridcell in both spellings and deterministic semantic focus steps', () => {
    const compiled = compile(source);
    expect(compiled.diagnostics).toEqual([]);
    const result = load(compiled.text!);
    expect(result.diagnostics).toEqual([]);
    expect(compile(decompile(result.model!.doc)).doc?.nodes).toEqual(compiled.doc!.nodes);
    const run = runScript(
      result.model!,
      'advance 0\nsnapshot --semantics\nsemantic day1 focus\nsnapshot --semantics\nsemantic day4 focus\nsnapshot --semantics',
    );
    const trees = run.snapshots.map(
      (s) => (s as unknown as { semantics: SemanticNode[] }).semantics,
    );
    expect(signature(trees[0]!)).toEqual([
      [
        'tools',
        'toolbar',
        [],
        [
          ['bold', 'button', ['tap', 'focus'], []],
          ['help', 'button', ['focus'], []],
        ],
      ],
      [
        'dates',
        'grid',
        [],
        [
          [
            'week1',
            'row',
            [],
            [
              ['day1', 'gridcell', ['focus'], []],
              ['day2', 'gridcell', ['focus'], []],
            ],
          ],
          [
            'week2',
            'row',
            [],
            [
              ['day3', 'gridcell', ['focus'], []],
              ['day4', 'gridcell', ['focus'], []],
            ],
          ],
        ],
      ],
    ]);
    const focused = (nodes: SemanticNode[]): string[] =>
      nodes.flatMap((n) => [...(n.states.focused ? [n.id] : []), ...focused(n.children)]);
    expect(trees.map(focused)).toEqual([[], ['day1'], ['day4']]);
    expect(run.snapshots.map((s) => s.events)).toEqual([[], [], []]);
    expect(run.snapshots.map((s) => s.settled)).toEqual([true, true, true]);
  });
});
