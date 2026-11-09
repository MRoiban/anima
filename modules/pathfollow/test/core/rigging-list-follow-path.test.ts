import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { compile } from '@anima-format/markup';

it('registers the JSON discriminator and spread-along-path AniML spelling', () => {
  const result = compile(
    '<anima version="0.1" name="spread" grid="20" requires="rig pathfollow"><path id="track" d="M0 0L10 0"/><group id="beads"><spread-along-path path="track" start="0.1" end="0.9" shift="0.05" orient="true"/><circle id="a" cx="0" cy="0" r="1"/><circle id="b" cx="0" cy="0" r="1"/></group></anima>',
  );
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect((result.doc!.nodes as { constraints?: object[] }[])[1]!.constraints).toEqual([
    {
      kind: 'spreadAlongPath',
      path: 'track',
      start: 0.1,
      end: 0.9,
      shift: 0.05,
      orient: true,
    },
  ]);
});
