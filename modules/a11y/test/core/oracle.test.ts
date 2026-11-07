import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { load, runScript } from '@anima-format/core';
import { compile } from '@anima-format/markup';
import type { SemanticNode } from '../../core/types.ts';
const root = new URL('../../oracle/roles/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
interface NativeNode {
  role: string;
  label: string;
  stateFlags: number;
  bounds: { x: number; y: number; width: number; height: number };
}
const roleNames: Record<string, string> = {
  switchControl: 'switch',
  radioButton: 'radio',
  radioGroup: 'radio-group',
  tabList: 'tab-list',
  listItem: 'list-item',
  alertDialog: 'alert-dialog',
  image: 'img',
};
it('matches 16 native roles, labels, bounds and state projections across target and next focus', () => {
  const result = compile(read('case.animl'));
  expect(result.diagnostics).toEqual([]);
  expect(result.text).toBe(read('case.ani'));
  const model = load(result.doc!).model!;
  const { snapshots } = runScript(model, read('script.txt'));
  expect(snapshots).toHaveLength(3);
  for (const [i, frame] of ['before', 'focused', 'next'].entries()) {
    const actual = snapshots[i]!.semantics as SemanticNode[];
    const native = (JSON.parse(read('frames/' + frame + '.json')) as { roots: NativeNode[] }).roots;
    expect(native).toHaveLength(16);
    expect(
      actual.map((n) => ({
        role: n.role,
        label: n.label,
        bounds: n.bounds,
        checked: n.states.checked ?? false,
        pressed: n.states.pressed ?? false,
        selected: n.states.selected ?? false,
        expanded: n.states.expanded ?? false,
        readonly: n.states.readonly ?? false,
        disabled: n.states.disabled ?? false,
        focused: n.states.focused ?? false,
      })),
    ).toEqual(
      native.map((n) => {
        const role = roleNames[n.role] ?? n.role,
          f = n.stateFlags;
        return {
          role,
          label: n.label,
          bounds: [n.bounds.x, n.bounds.y, n.bounds.width, n.bounds.height],
          checked: role === 'switch' ? !!(f & 16) : f & 8 ? 'mixed' : !!(f & 4),
          pressed: role === 'button' && !!(f & 16),
          selected: !!(f & 2),
          expanded: !!(f & 1),
          readonly: !!(f & 1024),
          disabled: !!(f & 64),
          focused: !!(f & 128),
        };
      }),
    );
  }
});
