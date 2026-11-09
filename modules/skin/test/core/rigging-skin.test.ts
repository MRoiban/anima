import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load } from '@anima-format/core';

const baseDoc = () => ({
  anima: '0.1',
  name: 'skin-diags',
  grid: 20,
  requires: ['paint', 'rig', 'skin'],
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

it('reports unsupported skin hosts with a complete diagnostic', () => {
  const doc = baseDoc();
  doc.nodes[2] = {
    id: 'dot',
    type: 'circle',
    center: [0, 0],
    r: 2,
    skin: { bones: ['arm'] },
  } as never;
  const d = diagnostic(doc, 'rig-skin-host');
  expect(d.pointer).toBe('/nodes/2/skin');
  expect(d.severity).toBe('error');
});

it('reports animated path geometry with a complete diagnostic', () => {
  const doc = baseDoc() as ReturnType<typeof baseDoc> & { timelines: object };
  doc.timelines = {
    morph: {
      duration: 1,
      tracks: {
        'path.d': [
          [0, 'M0 0L10 0'],
          [1, 'M0 0L8 2'],
        ],
      },
    },
  };
  const d = diagnostic(doc, 'rig-skin-morph');
  expect(d.pointer).toBe('/nodes/2/skin');
  expect(d.severity).toBe('error');
});
