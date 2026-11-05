// M2 bell parity: swing and clapper angles sampled from bell.ani match the Rive keyframes in
// fixtures/bell/rive-reference/gen_scene.py (60 fps frames, radians), run through the same eases.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cubic, load, Player } from '../src/index.ts';

const gen = readFileSync(
  new URL('../../../fixtures/bell/rive-reference/gen_scene.py', import.meta.url),
  'utf8',
);
const frames = (name: string): [number, number][] => {
  const m = new RegExp(`${name} = \\[(.*?)\\]\\n`).exec(gen)!;
  return [...m[1]!.matchAll(/\((-?[\d.]+), (-?[\d.]+)\)/g)].map((x) => [
    Number(x[1]) / 60,
    (Number(x[2]) * 180) / Math.PI,
  ]);
};
const ease = (src: string) => {
  const m = new RegExp(
    `${src} = '<CubicEaseInterpolator x1="([\\d.]+)" y1="([\\d.]+)" x2="([\\d.]+)" y2="([\\d.]+)"`,
  ).exec(gen)!;
  return cubic(...(m.slice(1).map(Number) as [number, number, number, number]));
};
const OUT = ease('EASE_OUT');
const IO = ease('EASE_IO');

/** Rive's rule: the first segment uses EASE_OUT, later ones EASE_IO, the last key holds. */
function rive(keys: [number, number][], t: number): number {
  if (t >= keys.at(-1)![0]) return keys.at(-1)![1];
  let i = 0;
  while (keys[i + 1]![0] <= t) i++;
  const [t0, v0] = keys[i]!;
  const [t1, v1] = keys[i + 1]!;
  return v0 + (v1 - v0) * (i === 0 ? OUT : IO)((t - t0) / (t1 - t0));
}

describe('bell parity with the Rive version', () => {
  const model = load(
    readFileSync(new URL('../../../examples/bell.ani', import.meta.url), 'utf8'),
  ).model!;
  const swing = frames('swing');
  const clap = frames('clap');

  it('reads the generator', () => {
    expect(swing.length).toBe(8);
    expect(clap.length).toBe(8);
  });

  it('swing.rotate and clapper.rotate agree to 1e-3° over the whole ring, at 240 Hz', () => {
    const p = new Player(model);
    p.fire('ring');
    p.step(0);
    let worst = 0;
    for (let k = 1; k <= 1.4 * 240; k++) {
      p.step(1 / 240);
      const t = k / 240;
      worst = Math.max(worst, Math.abs((p.value('swing.rotate') as number) - rive(swing, t)));
      worst = Math.max(worst, Math.abs((p.value('clapper.rotate') as number) - rive(clap, t)));
    }
    expect(worst).toBeLessThan(1e-3);
    console.log(`bell parity: worst angle error ${worst.toExponential(2)}°`);
    p.step(1 / 240); // 336 steps of 1/240 s sum to just under 1.4 s in floating point
    expect(p.states().ring).toBe('rested');
    expect(p.value('dot.scale')).toBe(1);
  });
});
