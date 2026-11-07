import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { load, Player } from '@anima-format/core';
const flat = (
  nodes: { label?: string; children: unknown[] }[],
): { label?: string; children: unknown[] }[] =>
  nodes.flatMap((n) => [n, ...flat(n.children as typeof nodes)]);
it('[P3b-10a] matches native ancestry, targets, initial Tab and hidden-retarget projections', () => {
  const result = load(
    readFileSync(new URL('../../examples/focus-ancestor-policy.ani', import.meta.url), 'utf8'),
  );
  expect(result.diagnostics).toEqual([]);
  const p = new Player(result.model!);
  const actions = [
    () => p.semanticAction('child', 'focus'),
    () => p.semanticAction('parent', 'focus'),
    () => p.focusTraverse('next'),
    () => {
      p.semanticAction('child', 'focus');
      p.set('hideChild', true);
    },
  ];
  for (const [i, stage] of ['child', 'parent', 'first', 'hidden'].entries()) {
    actions[i]!();
    p.step(0);
    const native = JSON.parse(
      readFileSync(
        new URL(`../../oracle/focus-policy/frames/${stage}.json`, import.meta.url),
        'utf8',
      ),
    );
    const expected = (
      flat(native.roots) as {
        label: string;
        stateFlags: number;
        traitFlags: number;
        children: unknown[];
      }[]
    )
      .filter((n) => n.label !== 'condition-marker')
      .map((n) => ({
        id: n.label,
        focused: !!(n.stateFlags & 128),
        focusable: !!(n.traitFlags & 64),
      }));
    const actual = flat(p.semantics()) as unknown as {
      id: string;
      states: { focused?: boolean };
      actions: string[];
      children: unknown[];
    }[];
    expect(
      actual.map((n) => ({
        id: n.id,
        focused: !!n.states.focused,
        focusable: n.actions.includes('focus'),
      })),
      stage,
    ).toEqual(expected);
  }
});
