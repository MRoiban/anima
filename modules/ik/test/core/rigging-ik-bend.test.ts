import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { compile, decompile } from '@anima-format/markup';

it('supports the ik child spelling, bend enum and canonical round trip', () => {
  const source =
    '<anima version="0.1" name="ik-bend" grid="20" requires="rig ik"><bone id="a" length="5"><bone id="b" length="4"><ik target="target" bones="2" bend="ccw"/></bone></bone><group id="target" x="6" y="2"/></anima>';
  const built = compile(source);
  expect(built.diagnostics).toEqual([]);
  const child = (built.doc!.nodes as { children?: { constraints?: object[] }[] }[])[0]!
    .children![0]!;
  expect(child.constraints).toEqual([{ kind: 'ik', target: 'target', bones: 2, bend: 'ccw' }]);
  expect(compile(decompile(built.doc!)).diagnostics).toEqual([]);
});
