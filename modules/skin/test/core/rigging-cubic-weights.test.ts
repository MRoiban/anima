import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { drawFrame, load, Player } from '@anima-format/core';

type TestSkinNode = {
  d: string;
  skin: {
    bones: string[];
    weights?: {
      point?: Record<string, number>;
      in?: Record<string, number>;
      out?: Record<string, number>;
    }[];
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

it('accepts independent point, in and out influence maps', () => {
  const doc = baseDoc();
  const path = doc.nodes[2] as TestSkinNode;
  path.d = 'M0 0C2 0 8 0 10 0';
  path.skin.weights = [
    { point: { arm: 1 }, out: { '@rest': 1 } },
    { point: { arm: 1 }, in: { '@rest': 1 } },
  ];
  expect(load(doc).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
});

it('applies complete diagnostics to handle weights too', () => {
  const doc = baseDoc();
  const path = doc.nodes[2] as TestSkinNode;
  path.d = 'M0 0C2 0 8 0 10 0';
  path.skin.weights = [
    { point: { arm: 1 }, out: { other: 0.25 } },
    { point: { arm: 1 }, in: { arm: 1 } },
  ];
  const bone = diagnostic(doc, 'rig-weight-bone');
  expect(bone.pointer).toBe('/nodes/2/skin/weights/0/out/other');
  const sum = diagnostic(doc, 'rig-weight-sum');
  expect(sum.pointer).toBe('/nodes/2/skin/weights/0/out');
  expect(sum.severity).toBe('warning');
});

it('deforms cubic handles independently from their @rest anchors', () => {
  const doc = baseDoc() as ReturnType<typeof baseDoc> & { timelines: object; machine: object };
  const path = doc.nodes[2] as TestSkinNode;
  path.d = 'M0 0C2 0 8 0 10 0';
  path.skin.weights = [
    { point: { '@rest': 1 }, out: { arm: 1 } },
    { point: { '@rest': 1 }, in: { arm: 1 } },
  ];
  doc.timelines = {
    bend: {
      duration: 1,
      tracks: {
        'arm.rotate': [
          [0, 0],
          [1, 90],
        ],
      },
    },
  };
  doc.machine = { layers: { main: { initial: 'bend', states: { bend: { play: 'bend' } } } } };
  const loaded = load(doc);
  expect(loaded.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const player = new Player(loaded.model!);
  player.step(1);
  expect(drawFrame(player).nodes[2]!.geometry!.d).toBe('M0 0C0 2 0 8 10 0');
});
