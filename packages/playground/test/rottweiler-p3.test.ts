import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';
import { sampleTimeline } from '../src/pure.ts';

// Rottweiler P3 R1-06: scrubbing a timeline with data-bound keyframes reads the live player.
it('samples data-bound keyframes through the live player', () => {
  const { model } = load(
    readFileSync(
      new URL('../../../spec/conformance/data-bind-keyframes/case.ani', import.meta.url),
      'utf8',
    ),
  );
  const player = new Player(model!);
  const doc = sampleTimeline(model!, model!.timelines[0]!, 0.5, player) as {
    machine: { layers: { scrub: { states: { sample: { pose: Record<string, unknown> } } } } };
  };
  const pose = doc.machine.layers.scrub.states.sample.pose;
  const track = model!.timelines[0]!.tracks[0]!;
  expect(typeof pose[track.addr]).toBe('number');
  expect(Number.isFinite(pose[track.addr])).toBe(true);
});
