import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load } from '@anima-format/core';

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

it('accepts independent point, in and out influence maps', () => {
  const doc = baseDoc();
  (doc.nodes[2] as any).d = 'M0 0C2 0 8 0 10 0';
  (doc.nodes[2] as any).skin.weights = [
    { point: { arm: 1 }, out: { '@rest': 1 } },
    { point: { arm: 1 }, in: { '@rest': 1 } },
  ];
  expect(load(doc).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
});

it('applies complete diagnostics to handle weights too', () => {
  const doc = baseDoc();
  (doc.nodes[2] as any).d = 'M0 0C2 0 8 0 10 0';
  (doc.nodes[2] as any).skin.weights = [
    { point: { arm: 1 }, out: { other: 0.25 } },
    { point: { arm: 1 }, in: { arm: 1 } },
  ];
  const bone = diagnostic(doc, 'rig-weight-bone');
  expect(bone.pointer).toBe('/nodes/2/skin/weights/0/out/other');
  const sum = diagnostic(doc, 'rig-weight-sum');
  expect(sum.pointer).toBe('/nodes/2/skin/weights/0/out');
  expect(sum.severity).toBe('warning');
});
