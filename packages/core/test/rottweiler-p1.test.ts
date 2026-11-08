import { describe, expect, it } from 'vitest';
import { load, Player, runScript, toSVG } from '../src/index.ts';
import { flatten, parsePath } from '../src/path.ts';

const base = (extra: Record<string, unknown> = {}) => ({
  anima: '0.1',
  name: 'probe',
  grid: 20,
  nodes: [{ type: 'circle', id: 'dot', center: [10, 10], r: 5, fill: { color: '#000' } }],
  ...extra,
});
const play = (timeline: Record<string, unknown>) =>
  base({
    timelines: { t: timeline },
    machine: { layers: { main: { initial: 'idle', states: { idle: { play: 't' } } } } },
  });
const player = (doc: unknown) => {
  const { model, diagnostics } = load(doc);
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(model!);
};
const codes = (doc: unknown) => load(doc).diagnostics.map((d) => [d.code, d.pointer]);

describe('Rottweiler P1 core', () => {
  // R1-01: a period index beyond 2^53 has k + 1 === k; event enumeration must still terminate.
  it('enumerates events at huge clock times without hanging', () => {
    const p = player(play({ duration: 1, loop: 'loop', tracks: {}, events: [[0.5, 'tick']] }));
    p.step(1e20);
    expect(p.step(0).events.length).toBeLessThanOrEqual(1);
  });

  // R1-02: an event recognised within ε of the clock is not reported again when reduced motion
  // freezes its timeline at the end.
  it('does not repeat an event recognised within ε when reduced motion freezes the timeline', () => {
    const p = player(
      play({
        duration: 1,
        tracks: {
          'dot.x': [
            [0, 0],
            [1, 10],
          ],
        },
        events: [[0.5, 'tick']],
      }),
    );
    expect(p.step(0.5 - 5e-10).events.map((e) => e.name)).toEqual(['tick']);
    p.reducedMotion = true;
    expect(p.step(0).events).toEqual([]);
    expect(p.value('dot.x')).toBe(10);
  });

  // R1-03: step(Infinity) is rejected before it poisons the clock.
  it('rejects a non-finite dt without changing the clock', () => {
    const p = player(
      play({
        duration: 1,
        loop: 'loop',
        tracks: {
          'dot.x': [
            [0, 0],
            [1, 1],
          ],
        },
      }),
    );
    expect(() => p.step(Infinity)).toThrow(/dt/);
    expect(p.time).toBe(0);
  });

  // R1-05: `$comment` is allowed on any object (SPEC §2), including the inputs/colors/timelines maps.
  it('ignores $comment in the inputs, colors and timelines maps', () => {
    for (const key of ['inputs', 'colors', 'timelines']) {
      const { model, diagnostics } = load(base({ [key]: { $comment: 'hello' } }));
      expect(diagnostics).toEqual([]);
      expect(model!.timelines).toEqual([]);
      expect(model!.inputs.size).toBe(0);
      expect(Object.keys(model!.colors)).toEqual([]);
    }
  });

  // R1-06: inherited Object.prototype members are not properties.
  it('rejects addresses that name inherited object members', () => {
    for (const addr of [
      'dot.constructor',
      'dot.toString',
      'dot.fill.constructor',
      'dot.fill.toString',
    ])
      expect(
        codes(
          base({
            machine: {
              layers: { main: { initial: 'idle', states: { idle: { pose: { [addr]: 1 } } } } },
            },
          }),
        ),
      ).toEqual([['unknown-address', `/machine/layers/main/states/idle/pose/${addr}`]]);
  });

  // R1-07: textual ease and path numbers must be finite.
  it('rejects non-finite ease arguments and path coordinates', () => {
    for (const ease of ['cubic(0,1e999,1,0)', 'elastic(1e999,1)', 'elastic(1,1e999)'])
      expect(
        codes(
          play({
            duration: 1,
            tracks: {
              'dot.x': [
                [0, 0, ease],
                [1, 1],
              ],
            },
          }),
        ),
      ).toEqual([['bad-ease', '/timelines/t/tracks/dot.x/0/2']]);
    expect(() => parsePath('M1e999 0L1 1')).toThrow(/finite/);
  });

  // R1-08: path numbers longer than 40 characters are tokenized whole.
  it('parses a long valid path number', () => {
    const [sp] = parsePath('M0.00000000000000000000000000000000000000001 0L1 1');
    expect(sp!.segs).toEqual([0, 1e-41, 0, 1, 1, 1]);
  });
});

describe('Rottweiler P1 hit testing (spec §9: the painted area)', () => {
  const clicks = (node: Record<string, unknown>, x: number, y: number) => {
    const p = player(
      base({
        nodes: [{ id: 'n', ...node }],
        listeners: [{ on: 'down', target: 'n', emit: 'hit' }],
      }),
    );
    p.pointer('down', x, y);
    return p.step(0).events.map((e) => e.name);
  };

  // R1-13: SVG fills close open subpaths implicitly.
  it('hits the interior of a filled open path', () => {
    expect(clicks({ type: 'path', d: 'M0 0L20 0L0 20', fill: { color: '#000' } }, 5, 5)).toEqual([
      'hit',
    ]);
  });

  // R1-14: rounded corners are not painted.
  it('misses outside a rounded rectangle corner', () => {
    const rect = { type: 'rect', x0: 0, y0: 0, w: 20, h: 20, rx: 10, fill: { color: '#000' } };
    expect(clicks(rect, 1, 1)).toEqual([]);
    expect(clicks(rect, 10, 1)).toEqual(['hit']);
    expect(clicks({ ...rect, w: 20, h: 8, rx: 6 }, 0.5, 0.5)).toEqual([]);
  });

  // R1-15: only the visible part of a trimmed stroke hits.
  it('hits only the visible part of a trimmed stroke', () => {
    const ring = { type: 'circle', center: [10, 10], r: 5, stroke: { color: '#000', width: 1 } };
    expect(clicks({ ...ring, stroke: { ...ring.stroke, trimEnd: 0 } }, 15, 10)).toEqual([]);
    const quarter = { ...ring, stroke: { ...ring.stroke, trimEnd: 0.25 } };
    const d = 5 / Math.SQRT2;
    expect(clicks(quarter, 10 + d, 10 + d)).toEqual(['hit']);
    expect(clicks(quarter, 5, 10)).toEqual([]);
    // Visible 0.75…1.25 of the outline, wrapping through angle 0.
    const wrap = { ...ring, stroke: { ...ring.stroke, trimStart: 0.5, trimOffset: 0.25 } };
    expect(clicks(wrap, 15, 10)).toEqual(['hit']);
    expect(clicks(wrap, 5, 10)).toEqual([]);
  });

  // R1-16: curves are flattened finely enough for the 0.05-unit tolerance.
  it('hits points farther than 0.05 units inside a large circle and a large cubic', () => {
    const a = (3 * Math.PI) / 180;
    expect(
      clicks(
        { type: 'circle', center: [0, 0], r: 100, fill: { color: '#000' } },
        99.9 * Math.cos(a),
        99.9 * Math.sin(a),
      ),
    ).toEqual(['hit']);
    // A quarter circle of radius 100 as one cubic (kappa 0.5523), closed through the centre.
    const k = 55.23;
    const d = `M100 0C100 ${k} ${k} 100 0 100L0 0Z`;
    // Between the first two of the former 12 fixed steps, where their chord cut 0.2 units inside.
    const b = (3.75 * Math.PI) / 180;
    expect(
      clicks({ type: 'path', d, fill: { color: '#000' } }, 99.9 * Math.cos(b), 99.9 * Math.sin(b)),
    ).toEqual(['hit']);
  });
});

describe('Rottweiler P1 round 2', () => {
  const hit = (node: Record<string, unknown>, x: number, y: number, extra = {}) => {
    const { pose, ...rest } = node;
    const p = player(
      base({
        nodes: [{ id: 'n', ...rest }],
        listeners: [{ on: 'down', target: 'n', emit: 'hit', ...extra }],
        ...(pose ? { machine: { layers: { l: { initial: 's', states: { s: { pose } } } } } } : {}),
      }),
    );
    p.step(0);
    p.pointer('down', x, y);
    return p.step(0).events.map((e) => e.name);
  };

  // R2-01: the tolerance-driven step count is bounded (it allocated until the heap ran out).
  it('flattens a huge cubic with bounded work', () => {
    expect(
      hit({ type: 'path', d: 'M0 0C0 1e100 1e100 1e100 1e100 0', fill: { color: '#000' } }, 1, 1),
    ).toEqual(['hit']);
  });

  // R2-05: the 0.05 tolerance is in world units, so a scaled-up circle is flattened finer.
  it('hits 0.1 world units inside a scaled-up circle', () => {
    const a = (3 * Math.PI) / 180;
    expect(
      hit(
        { type: 'circle', center: [0, 0], r: 1, scale: 100, fill: { color: '#000' } },
        99.9 * Math.cos(a),
        99.9 * Math.sin(a),
      ),
    ).toEqual(['hit']);
  });

  // R2-06: rounded corners are sampled on the true ellipse, not a cubic approximation.
  it('misses 0.1 outside a large rounded corner', () => {
    const a = (199 * Math.PI) / 180;
    const rect = {
      type: 'rect',
      x0: 0,
      y0: 0,
      w: 2000,
      h: 2000,
      rx: 1000,
      fill: { color: '#000' },
    };
    expect(hit(rect, 1000 + 1000.1 * Math.cos(a), 1000 + 1000.1 * Math.sin(a))).toEqual([]);
    expect(hit(rect, 1000 + 999.9 * Math.cos(a), 1000 + 999.9 * Math.sin(a))).toEqual(['hit']);
  });

  // R2-07: fill padding grows the implicitly closed fill area.
  it('pads the implicit closing edge of an open filled path', () => {
    const tri = { type: 'path', d: 'M0 0L20 0L0 20', fill: { color: '#000' } };
    expect(hit(tri, -0.5, 5, { hitPadding: 1 })).toEqual(['hit']);
    expect(hit(tri, -1.5, 5, { hitPadding: 1 })).toEqual([]);
  });

  // R2-08: an animated arc sweeps as drawn, clamped to [0, 360].
  it('hits nothing on an arc animated to a negative sweep', () => {
    const arc = {
      type: 'arc',
      center: [10, 10],
      r: 5,
      from: 0,
      to: 90,
      stroke: { color: '#000', width: 1 },
      pose: { 'n.to': -90 },
    };
    expect(hit(arc, 10, 5)).toEqual([]);
  });

  // R2-10: finite arguments whose sum overflows are still finite.
  it('accepts finite ease arguments whose sum overflows', () => {
    expect(
      codes(
        play({
          duration: 1,
          tracks: {
            'dot.x': [
              [0, 0, 'cubic(0,1e308,1,1e308)'],
              [1, 1],
            ],
          },
        }),
      ),
    ).toEqual([]);
  });
});

describe('Rottweiler P1 round 3', () => {
  const hits = (node: Record<string, unknown>, x: number, y: number, hitPadding = 0) => {
    const p = player(
      base({
        nodes: [{ id: 'n', ...node }],
        listeners: [{ on: 'move', target: 'n', hitPadding, emit: 'hit' }],
      }),
    );
    return p.hits(p.model.listeners[0]!, x, y);
  };

  // R3-01: a segment after Z starts a new contour at the subpath start (SVG), not at the last point.
  it('starts a new contour after Z', () => {
    const tri = { type: 'path', d: 'M0 0L10 0L10 10ZL0 10', fill: { color: '#000' } };
    expect(hits(tri, 2, 8)).toBe(false);
    expect(hits(tri, 8, 2)).toBe(true);
    expect(flatten(parsePath('M0 0L10 0L10 10ZL0 10'))).toEqual([
      { pts: [0, 0, 10, 0, 10, 10], closed: true },
      { pts: [0, 0, 0, 10], closed: false },
    ]);
  });

  // R3-02: hit padding is in world units, also under a nonuniform scale.
  it('pads in world units under a nonuniform scale', () => {
    const rect = { type: 'rect', x0: 0, y0: 0, w: 10, h: 10, scaleX: 10, fill: { color: '#000' } };
    expect(hits(rect, 102, 5, 1)).toBe(false);
    expect(hits(rect, 50, -0.5, 1)).toBe(true);
    expect(hits(rect, 100.5, 5, 1)).toBe(true);
  });

  // R3-11: the 1 MiB text limit counts UTF-8 bytes.
  it('limits documents to 1 MiB of UTF-8 text', () => {
    const text = JSON.stringify(base({ title: 'é'.repeat(600_000) }));
    expect(load(text).diagnostics.map((d) => d.code)).toEqual(['limit-exceeded']);
    expect(load(JSON.stringify(base({ title: 'é'.repeat(500_000) }))).diagnostics).toEqual([]);
  });

  // R3-10: a pending expect-error also covers a line that does not tokenize.
  it('lets expect-error catch a tokenizer error', () => {
    const { model } = load(base());
    expect(runScript(model!, 'expect-error script-usage\nset x "unterminated').diagnostics).toEqual(
      [],
    );
    expect(
      runScript(model!, 'expect-error script-expect\nset x "unterminated').diagnostics.map(
        (d) => d.code,
      ),
    ).toEqual(['script-expect-error']);
  });
});

describe('Rottweiler P1 round 4', () => {
  // R4-04: a node with neither fill nor stroke draws nothing, so its knockout cuts nothing.
  it('cuts nothing for an unpainted knockout node', () => {
    const p = player(
      base({
        nodes: [
          { id: 'bg', type: 'rect', x0: 0, y0: 0, w: 20, h: 20, fill: { color: '#f00' } },
          { id: 'line', type: 'path', d: 'M0 10L20 10', knockout: 2 },
        ],
      }),
    );
    const cut = /<mask[\s\S]*<\/mask>/.exec(toSVG(p))![0];
    expect(cut).toContain('d="M0 10L20 10"');
    expect(cut).not.toContain('stroke="#000"');
  });

  // R4-05: a new player's values are clamped as by step 4 (spec §7).
  it('clamps the initial resolved values', () => {
    const p = player(
      base({
        machine: {
          layers: {
            main: { initial: 'a', states: { a: { pose: { 'dot.opacity': 2, 'dot.r': -2 } } } },
          },
        },
      }),
    );
    expect(p.values()).toEqual({ 'dot.opacity': 1, 'dot.r': 0 });
  });
});

describe('Rottweiler P1 round 5', () => {
  const hits = (node: Record<string, unknown>, x: number, y: number, hitPadding = 0) => {
    const p = player(
      base({
        nodes: [{ id: 'n', ...node }],
        listeners: [{ on: 'move', target: 'n', hitPadding, emit: 'hit' }],
      }),
    );
    return p.hits(p.model.listeners[0]!, x, y);
  };

  // R5-01: trims dash the whole outline (period = its full length), restarting at each contour.
  it('trims a path with a contour after Z as SVG dashes it', () => {
    const node = {
      type: 'path',
      d: 'M5 5L25 5L25 25ZL5 25',
      stroke: { color: '#000', width: 1, trimEnd: 0.5 },
    };
    expect(hits(node, 25, 20)).toBe(true);
    expect(hits(node, 5, 20)).toBe(true);
    expect(hits(node, 10, 10)).toBe(false);
  });

  // R5-04: an unpainted node has no painted area for hit padding to grow.
  it('gives an unpainted node no padded hit area', () => {
    expect(hits({ type: 'rect', x0: 2, y0: 2, w: 10, h: 10 }, 1.5, 5, 1)).toBe(false);
  });
});
