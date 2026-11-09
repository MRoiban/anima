import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load } from '@anima-format/core';
import { compile } from '@anima-format/markup';

const base = (nodes: object[]) => ({
  anima: '0.1',
  name: 'scroll-diagnostics',
  grid: 20,
  requires: ['rig', 'input', 'scroll'],
  nodes,
});

it('reports scroll-viewport for a missing or unmeasurable viewport', () => {
  for (const [viewport, extra] of [
    ['missing', []],
    ['empty', [{ id: 'empty', type: 'group' }]],
  ] as const) {
    const result = load(
      base([
        {
          id: 'content',
          type: 'group',
          constraints: [{ kind: 'scroll', viewport, axis: 'y' }],
          children: [{ id: 'body', type: 'rect', x0: 0, y0: 0, w: 10, h: 30 }],
        },
        ...extra,
      ]),
    );
    expect(result.model).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'scroll-viewport',
        pointer: '/nodes/0/constraints/0/viewport',
        severity: 'error',
        message: expect.stringContaining('measurable bounds'),
        hint: expect.stringContaining('rest geometry'),
      }),
    );
  }
});

it('uses rig-target for an unknown scrollThumb scroll target', () => {
  const result = load(
    base([
      { id: 'viewport', type: 'rect', x0: 0, y0: 0, w: 10, h: 10 },
      { id: 'track', type: 'rect', x0: 12, y0: 0, w: 2, h: 10 },
      {
        id: 'thumb',
        type: 'rect',
        x0: 12,
        y0: 0,
        w: 2,
        h: 2,
        constraints: [{ kind: 'scrollThumb', scroll: 'missing', track: 'track', axis: 'y' }],
      },
    ]),
  );
  expect(result.model).toBeUndefined();
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'rig-target',
      pointer: '/nodes/2/constraints/0',
      severity: 'error',
      message: expect.stringContaining('missing'),
      hint: expect.stringContaining('existing node id'),
    }),
  );
});

it('registers scroll and scroll-thumb AniML spellings', () => {
  const result = compile(`
    <anima version="0.1" name="scroll-markup" grid="20" requires="rig input scroll">
      <rect id="viewport" x0="0" y0="0" width="10" height="10"/>
      <group id="content">
        <scroll viewport="viewport" axis="y" offset-y="3" interactive="true"/>
        <rect id="body" x0="0" y0="0" width="10" height="30"/>
      </group>
      <rect id="track" x0="12" y0="0" width="2" height="10"/>
      <rect id="thumb" x0="12" y0="0" width="2" height="2">
        <scroll-thumb scroll="content" track="track" axis="y" resize="true"/>
      </rect>
    </anima>`);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const nodes = result.doc!.nodes as { id: string; constraints?: object[] }[];
  expect(nodes.find((n) => n.id === 'content')!.constraints).toEqual([
    { kind: 'scroll', viewport: 'viewport', axis: 'y', offsetY: 3, interactive: true },
  ]);
  expect(nodes.find((n) => n.id === 'thumb')!.constraints).toEqual([
    { kind: 'scrollThumb', scroll: 'content', track: 'track', axis: 'y', resize: true },
  ]);
});
