import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { compile, decompile } from '@anima-format/markup';

it('authors skin with the child AniML spelling and round-trips it canonically', () => {
  const source = `<anima version="0.1" name="skin-markup" grid="20" requires="paint rig skin">
  <bone id="arm" length="10"/>
  <path id="sleeve" d="M0 0L10 0" stroke="#000">
    <skin bones="arm" weights='[{"point":{"arm":1}},{"point":{"arm":1}}]'/>
  </path>
</anima>`;
  const result = compile(source);
  expect(result.diagnostics).toEqual([]);
  expect((result.doc!.nodes as any[])[1]!.skin).toEqual({
    bones: ['arm'],
    weights: [{ point: { arm: 1 } }, { point: { arm: 1 } }],
  });
  const canonical = decompile(result.doc!);
  expect(canonical).toContain('<skin bones="arm"');
  expect(canonical).not.toContain('skin="{');
  expect(compile(canonical).doc).toEqual(result.doc);
});
