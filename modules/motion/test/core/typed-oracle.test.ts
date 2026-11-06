import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { compile, decompile } from '@anima-format/markup';
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

it('round-trips the maximum uint track through AniML and JSON without signed conversion', () => {
  const source = readFileSync(
    new URL(
      '../../../../spec/conformance/animation-keys-unsigned-integer/case.animl',
      import.meta.url,
    ),
    'utf8',
  );
  const first = compile(source);
  expect(first.diagnostics).toEqual([]);
  const again = compile(decompile(first.text!));
  expect(again.diagnostics).toEqual([]);
  expect(again.text).toBe(first.text);
  const doc = JSON.parse(again.text!);
  expect(doc.timelines.t.tracks['a.channels.v']).toEqual([
    [0, 0],
    [1, 4294967295],
  ]);
  const { model, diagnostics } = load(JSON.stringify(doc));
  expect(diagnostics).toEqual([]);
  const player = new Player(model!);
  const track = player.timeline('t').pause();
  for (const [time, value] of [
    [0.5, 0],
    [1, 4294967295],
    [2, 4294967295],
    [0, 0],
  ]) {
    track.seek(time!);
    player.step(0);
    expect(player.node('a')!.get('channels.v')).toBe(value);
  }
});
