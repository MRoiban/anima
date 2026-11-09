import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load } from '@anima-format/core';

type TestSkinNode = {
  skin: {
    bones: string[];
    weights?: { point?: Record<string, number> }[];
  };
};

const baseDoc = () => ({
  anima: '0.1',
  name: 'skin-diags',
  grid: 20,
  requires: ['rig', 'skin'],
  nodes: [
    { id: 'arm', type: 'bone', length: 10 },
    { id: 'other', type: 'bone', length: 10 },
    { id: 'path', type: 'path', d: 'M0 0L10 0', skin: { bones: ['arm'] } },
  ],
});

const diagnostic = (doc: ReturnType<typeof baseDoc>, code: string) => {
  const d = load(doc).diagnostics.find((x) => x.code === code);
  expect(d).toEqual(
    expect.objectContaining({
      code,
      pointer: expect.any(String),
      message: expect.any(String),
      hint: expect.any(String),
      severity: expect.any(String),
    }),
  );
  return d!;
};

it('limits explicit point weights to four influences', () => {
  const doc = baseDoc();
  doc.nodes.splice(
    2,
    0,
    { id: 'b2', type: 'bone', length: 10 } as never,
    { id: 'b3', type: 'bone', length: 10 } as never,
    { id: 'b4', type: 'bone', length: 10 } as never,
  );
  const path = doc.nodes.at(-1)! as TestSkinNode;
  path.skin = {
    bones: ['arm', 'other', 'b2', 'b3', 'b4'],
    weights: [
      { point: { arm: 0.2, other: 0.2, b2: 0.2, b3: 0.2, b4: 0.2 } },
      { point: { arm: 1 } },
    ],
  };
  const d = diagnostic(doc, 'rig-weight-count');
  expect(d.pointer).toBe('/nodes/5/skin/weights/0/point');
  expect(d.severity).toBe('error');
});

it('warns and normalizes a non-unit sum', () => {
  const doc = baseDoc();
  (doc.nodes[2] as TestSkinNode).skin.weights = [{ point: { arm: 0.25 } }, { point: { arm: 1 } }];
  const d = diagnostic(doc, 'rig-weight-sum');
  expect(d.pointer).toBe('/nodes/2/skin/weights/0/point');
  expect(d.severity).toBe('warning');
  expect(load(doc).model).toBeDefined();
});

it('rejects influences outside skin.bones', () => {
  const doc = baseDoc();
  (doc.nodes[2] as TestSkinNode).skin.weights = [{ point: { other: 1 } }, { point: { arm: 1 } }];
  const d = diagnostic(doc, 'rig-weight-bone');
  expect(d.pointer).toBe('/nodes/2/skin/weights/0/point/other');
  expect(d.severity).toBe('error');
});

it('accepts @rest alongside declared bones', () => {
  const doc = baseDoc();
  (doc.nodes[2] as TestSkinNode).skin.weights = [
    { point: { arm: 0.5, '@rest': 0.5 } },
    { point: { '@rest': 1 } },
  ];
  expect(load(doc).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
});
