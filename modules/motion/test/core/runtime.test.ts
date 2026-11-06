import '@anima-format/core/all';
import { describe, expect, it } from 'vitest';
import { load, Player, toSVG, jsonSchema } from '@anima-format/core';
import { compile, decompile, formatMarkup } from '@anima-format/markup';
import { motionEase, valueCurve } from '../../core/curves.ts';
import { readFileSync } from 'node:fs';
const base = {
  anima: '0.1',
  name: 'test',
  grid: 20,
  requires: ['motion'],
  nodes: [{ id: 'a', type: 'circle', center: [0, 0], r: 1, fill: { color: '#000' } }],
  timelines: {
    t: {
      duration: 2,
      tracks: {
        'a.x': [
          [0, 0],
          [2, 20],
        ],
      },
    },
  },
};
const make = (doc: object = base) => {
  const r = load(structuredClone(doc));
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(r.model!);
};
describe('motion instance API', () => {
  it('returns detached metadata and reuses default handles, with validation', () => {
    const p = make(),
      t = p.timeline('t');
    expect(p.timeline('t')).toBe(t);
    expect(p.animations).toEqual([
      { name: 't', duration: 2, speed: 1, quantize: null, work: [0, 2], loop: 'once' },
    ]);
    p.animations[0]!.work[0] = 99;
    expect(t.info.work).toEqual([0, 2]);
    expect(() => p.timeline('missing')).toThrow('unknown timeline');
    expect(() => p.createTimeline('t', { name: 'invalid/name' })).toThrow('invalid instance name');
    expect(p.node('a')!.get('y')).toBe(0);
    expect(() => p.createTimeline('t')).toThrow('duplicate instance');
    expect(() => t.seek(NaN)).toThrow('finite');
    expect(() => t.advance(-1)).toThrow('dt');
    expect(() => {
      t.loop = 'bad' as 'once';
    }).toThrow('loop');
    t.loop = 'pingpong';
    t.loop = null;
    expect(t.loop).toBe('once');
  });
  it('advances independently, applies weighted samples and restores rest on stop', () => {
    const p = make(),
      t = p.createTimeline('t', { name: 'one', mix: 0.5 });
    t.advance(1);
    t.pause().apply();
    p.step(0);
    expect(p.value('a.x')).toBe(5);
    const u = p.createTimeline('t', { name: 'two', mix: 0.25 }).pause().seek(2);
    p.step(0);
    expect(p.value('a.x')).toBe(8.75);
    u.mix = 0;
    p.step(0);
    expect(p.value('a.x')).toBe(5);
    t.stop();
    p.step(0);
    expect(p.value('a.x')).toBe(0);
  });
  it('reverses at the current position and reports didLoop only on a crossing', () => {
    const p = make(),
      t = p.timeline('t');
    t.advance(1.5);
    t.speed = -1;
    t.advance(0.5);
    expect(t.time).toBe(1);
    expect(t.didLoop).toBe(false);
    t.advance(2);
    expect(t.time).toBe(0);
    expect(t.didLoop).toBe(true);
    t.advance(0);
    expect(t.didLoop).toBe(false);
    t.loop = 'loop';
    t.seek(0.5);
    t.advance(1);
    expect(t.time).toBe(1.5);
    expect(t.didLoop).toBe(true);
  });
  it('wakes a settled player, pauses with a held pose, and keeps zero speed idle', () => {
    const p = make();
    expect(p.step(0).settled).toBe(true);
    const t = p.timeline('t');
    expect(p.busy).toBe(true);
    expect(p.step(0.5).settled).toBe(false);
    t.pause();
    expect(p.step(1).settled).toBe(true);
    expect(p.value('a.x')).toBe(5);
    t.play();
    t.speed = 0;
    expect(p.step(1).settled).toBe(true);
    expect(p.value('a.x')).toBe(5);
  });
  it('provides typed node handles with animated local/world transforms', () => {
    const doc = structuredClone(base);
    Object.assign(doc.nodes[0]!, { rotate: 90, pivot: [0, 0] });
    Object.assign(doc.timelines.t.tracks, {
      'a.pivotX': [
        [0, 0],
        [2, 4],
      ],
    });
    const p = make(doc);
    p.timeline('t').pause().seek(1);
    p.step(0);
    const n = p.node('a', 'circle')!;
    expect(n.type).toBe('circle');
    expect(n.get('pivotX')).toBe(2);
    expect(n.local[4]).toBeCloseTo(12);
    expect(n.local[5]).toBeCloseTo(-2);
    expect(n.world).toEqual(n.local);
    expect(p.node('missing')).toBeUndefined();
    expect(p.node('a', 'group')).toBeUndefined();
    expect(toSVG(p)).toContain('matrix(');
  });
  it('supports empty named machines and isolates state-machine inputs', () => {
    const doc = {
      ...base,
      inputs: { flag: { type: 'bool' } },
      machines: {
        one: {
          layers: {
            l: {
              initial: 's',
              states: {
                s: { pose: { 'a.y': 3 }, on: [{ when: 'flag', to: 'next' }] },
                next: { pose: { 'a.y': 7 } },
              },
            },
          },
        },
        two: { layers: {} },
      },
    };
    const p = make(doc),
      m = p.machine('one');
    m.set('flag', true);
    p.step(0);
    expect(p.value('a.y')).toBe(7);
    expect(p.get('flag')).toBe(false);
    expect(m.states()).toEqual({ l: 'next' });
    p.machine('two');
    p.step(0);
    expect(p.value('a.y')).toBe(7);
    expect(() => p.machine('missing')).toThrow('unknown machine');
  });
  it('applies motion only to declared documents', () => {
    const doc = structuredClone(base);
    doc.requires = [];
    const p = make(doc);
    expect(() => p.timeline('t')).toThrow('requires motion');
  });
});
describe('motion sampling and clocks', () => {
  it('evaluates equal-endpoint value curves and endpoint values exactly', () => {
    const curve = valueCurve('value-cubic(0.3333333333333333,8,0.6666666666666666,8)', 0, 0) as (
      x: number,
    ) => number;
    expect(curve(0)).toBe(0);
    expect(curve(0.5)).toBeCloseTo(6, 10);
    expect(curve(1)).toBe(0);
    expect(valueCurve('value-cubic(2,0,0,0)', 0, 0)).toBeTypeOf('string');
  });
  it('uses independently computed elastic quarter/midpoint values and endpoint symmetry', () => {
    const inward = motionEase('elastic-in(1,0.5)') as (x: number) => number;
    const both = motionEase('elastic-in-out(1,0.5)') as (x: number) => number;
    expect(inward(0.5)).toBeCloseTo(1 / 32, 12);
    expect(both(0.25)).toBeCloseTo(1 / 64, 12);
    expect(both(0.75)).toBeCloseTo(63 / 64, 12);
    expect(both(0)).toBe(0);
    expect(both(1)).toBe(1);
  });
  it('uses an independent unquantized event clock across reverse loops and large pingpong steps', () => {
    const doc = structuredClone(base);
    Object.assign(doc.timelines.t, {
      work: [0.5, 1.5],
      quantize: 2,
      events: [
        [0.5, 'start'],
        [1, 'middle'],
        [1.5, 'end'],
      ],
    });
    const p = make(doc),
      t = p.timeline('t');
    t.loop = 'loop';
    t.seek(0.75);
    t.speed = -1;
    const events = t.advance(0.5);
    expect(events.map((e) => e.name)).toEqual(['start', 'end']);
    expect(t.time).toBe(1.25);
    t.loop = 'pingpong';
    t.speed = 1;
    t.seek(0.5);
    expect(t.advance(2.5).map((e) => e.name)).toEqual([
      'middle',
      'end',
      'middle',
      'start',
      'middle',
    ]);
  });
  it('freezes reduced end at the reverse work endpoint and excludes events outside the work area', () => {
    const doc = structuredClone(base);
    Object.assign(doc.timelines.t, {
      work: [0.5, 1.5],
      loop: 'loop',
      speed: -1,
      events: [
        [0, 'outside'],
        [1, 'inside'],
      ],
    });
    const p = make(doc);
    p.reducedMotion = true;
    p.timeline('t');
    const r = p.step(0.5);
    expect(p.value('a.x')).toBe(5);
    expect(r.events.map((e) => e.name)).toEqual(['inside']);
    expect(r.settled).toBe(true);
  });
  it('gates a fractional exit in source playback seconds and preserves overshoot', () => {
    const doc = {
      ...base,
      machine: {
        layers: {
          l: {
            initial: 's',
            states: {
              s: {
                play: 't',
                speed: 2,
                on: [{ when: '@after(0)', exitFraction: 0.5, to: 'next' }],
              },
              next: { play: 't' },
            },
          },
        },
      },
    };
    const p = make(doc);
    p.step(0.75);
    expect(p.inspect()[0]!.time).toBe(0.25);
    expect(p.value('a.x')).toBe(2.5);
  });
  it('assigns typed values at the start of a crossfade while numeric values interpolate', () => {
    const doc = {
      ...base,
      nodes: [
        {
          ...base.nodes[0],
          channels: { s: { type: 'string', value: 'idle' }, n: { type: 'int', value: 0 } },
        },
      ],
      inputs: { go: { type: 'trigger' } },
      machine: {
        layers: {
          l: {
            initial: 's',
            states: {
              s: {
                pose: { 'a.channels.s': 'idle', 'a.channels.n': 0, 'a.x': 0 },
                on: [{ when: 'go', to: 'next', blend: 1 }],
              },
              next: { pose: { 'a.channels.s': 'moving', 'a.channels.n': 2, 'a.x': 10 } },
            },
          },
        },
      },
    };
    const p = make(doc);
    p.fire('go');
    p.step(0);
    expect(p.value('a.channels.s')).toBe('moving');
    expect(p.value('a.channels.n')).toBe(2);
    expect(p.value('a.x')).toBe(0);
    p.step(0.5);
    expect(p.value('a.x')).toBe(5);
  });
});
describe('motion authoring integration', () => {
  it('round trips channels, quoted strings, named machines, timing and exits through both syntaxes', () => {
    const source = readFileSync(
      new URL('../../../../examples/motion.animl', import.meta.url),
      'utf8',
    );
    const c = compile(source);
    expect(c.diagnostics).toEqual([]);
    const d = decompile(c.doc!);
    const r = compile(d);
    expect(r.diagnostics).toEqual([]);
    expect(r.doc).toEqual(c.doc);
    expect(formatMarkup(d).text).toBe(d);
    expect(JSON.stringify(jsonSchema())).toContain('exitFraction');
  });
});
