import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load } from '@anima-format/core';
import { compile } from '@anima-format/markup';

it('reports rig-path-target with code, pointer, message and hint', () => {
  const result = load({
    anima: '0.1',
    name: 'invalid-follow',
    grid: 20,
    requires: ['rig', 'pathfollow'],
    nodes: [
      {
        id: 'dot',
        type: 'group',
        constraints: [{ kind: 'alongPath', path: 'target' }],
      },
      { id: 'target', type: 'group' },
    ],
  });
  expect(result.model).toBeUndefined();
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'rig-path-target',
      pointer: '/nodes/0/constraints/0/path',
      severity: 'error',
      message: expect.stringContaining('measurable shape'),
      hint: expect.stringContaining('path, contour, circle, rect or arc'),
    }),
  );
});

it('registers the JSON discriminator and along-path AniML spelling', () => {
  const result = compile(
    '<anima version="0.1" name="follow" grid="20" requires="rig pathfollow"><path id="track" d="M0 0L10 0"/><group id="dot"><along-path path="track" at="0.25" orient="true" offset="true"/></group></anima>',
  );
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect((result.doc!.nodes as { constraints?: object[] }[])[1]!.constraints).toEqual([
    { kind: 'alongPath', path: 'track', at: 0.25, orient: true, offset: true },
  ]);
});
