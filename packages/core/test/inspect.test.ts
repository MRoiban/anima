import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { load, Player } from '../src/index.ts';

const bell = readFileSync(new URL('../../../examples/bell.ani', import.meta.url), 'utf8');

describe('Player.inspect', () => {
  it('reports state, previous state, blend progress and timeline time per layer', () => {
    const p = new Player(load(bell).model!);
    p.step(0);
    expect(p.inspect()).toEqual([
      {
        layer: 'ring',
        state: 'idle',
        prev: null,
        blend: null,
        locked: false,
        timeline: null,
        time: null,
      },
      {
        layer: 'hover',
        state: 'rest',
        prev: null,
        blend: null,
        locked: false,
        timeline: null,
        time: null,
      },
    ]);
    p.set('hover', true);
    p.fire('ring');
    p.step(0);
    p.step(0.05);
    const [ring, hover] = p.inspect();
    expect(ring).toMatchObject({ state: 'ringing', prev: 'idle', timeline: 'ring' });
    expect(ring!.time).toBeCloseTo(0.05, 9);
    expect(hover).toMatchObject({ state: 'hover', prev: 'rest', locked: true }); // bell: interruptible="false"
    expect(hover!.blend).toBeGreaterThan(0);
    expect(hover!.blend).toBeLessThan(1);
    p.step(1);
    expect(p.inspect()[1]!.blend).toBeNull();
  });
});
