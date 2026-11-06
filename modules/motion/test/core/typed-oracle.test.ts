import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';

it('holds signed, unsigned and reference channels across exact keys and zero/positive instance mixes', () => {
  const { model, diagnostics } = load({
    anima: '0.1',
    name: 'typed-oracle',
    grid: 20,
    requires: ['motion'],
    nodes: [
      {
        id: 'a',
        type: 'circle',
        center: [0, 0],
        r: 1,
        fill: { color: '#000' },
        channels: {
          signed: { type: 'int', value: -2147483648 },
          unsigned: { type: 'uint', value: 0 },
          ref: { type: 'reference', value: 'a' },
        },
      },
      { id: 'b', type: 'circle', center: [1, 1], r: 1, fill: { color: '#000' } },
    ],
    timelines: {
      t: {
        duration: 2,
        tracks: {
          'a.channels.signed': [
            [0, -2147483648],
            [1, 2147483647],
          ],
          'a.channels.unsigned': [
            [0, 0],
            [1, 4294967295],
          ],
          'a.channels.ref': [
            [0, 'a'],
            [1, 'b'],
          ],
        },
      },
    },
  });
  expect(diagnostics).toEqual([]);
  const p = new Player(model!);
  const t = p.timeline('t').pause();
  const values = () => ['signed', 'unsigned', 'ref'].map((k) => p.node('a')!.get(`channels.${k}`));
  t.seek(0.999999);
  p.step(0);
  expect(values()).toEqual([-2147483648, 0, 'a']);
  t.seek(1);
  p.step(0);
  expect(values()).toEqual([2147483647, 4294967295, 'b']);
  t.mix = 0;
  p.step(0);
  expect(values()).toEqual([-2147483648, 0, 'a']);
  t.mix = 0.000001;
  p.step(0);
  expect(values()).toEqual([2147483647, 4294967295, 'b']);
});
