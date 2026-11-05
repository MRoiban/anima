import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Player, attrs, load, sceneTree, staticSlots, toSVG, jsonSchema } from '../src/index.ts';

const gradient = () => ({
  type: 'linear',
  x1: 0,
  y1: 0,
  x2: 20,
  y2: 0,
  stops: [
    { position: 0, color: '#f00' },
    { position: 1, color: '#00f' },
  ],
});
const document = (fill: object = gradient(), stroke?: object) => ({
  anima: '0.1',
  name: 'paint',
  grid: 20,
  requires: ['paint'],
  nodes: [{ id: 'a', type: 'rect', x0: 0, y0: 0, w: 20, h: 20, fill, ...(stroke && { stroke }) }],
});
const casePlayer = (name: string) => {
  const result = load(
    readFileSync(new URL(`../../../spec/conformance/${name}/case.ani`, import.meta.url), 'utf8'),
  );
  expect(result.diagnostics).toEqual([]);
  return new Player(result.model!);
};
const leaf = (p: Player, node: number) =>
  attrs(p, { tag: 'path', role: 'shape', node, kids: [] }, staticSlots(), 'test-');

describe('paint rendering and sampling', () => {
  it('renders gradients in grid coordinates, static slot colours and RGBA samples', () => {
    const p = casePlayer('paint-gradient');
    p.step(0.5);
    const svg = toSVG(p, { id: 'one-', paint: staticSlots({ accent: '#123456' }) });
    expect(svg).toContain('<linearGradient id="one-p0-fill" gradientUnits="userSpaceOnUse"');
    expect(svg).toContain('x1="2" y1="0" x2="16" y2="0"');
    expect(svg).toContain('<stop offset="0.25" stop-color="#80008080"/>');
    expect(svg).toContain('<stop offset="1" stop-color="#123456"/>');
    expect(svg).toContain('r="6" fx="9" fy="9"');
    expect(svg).toContain('fill="url(#one-p0-fill)"');
    expect(svg).toContain('stroke="url(#one-p0-stroke)"');
    expect(toSVG(p, { id: 'two-' })).not.toContain('one-');
    expect(sceneTree(p.model).defs).toHaveLength(2);
    expect(p.takeDirty()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('uses the resolved centre for omitted focal coordinates, or their own sampled values', () => {
    const doc = {
      ...document({ type: 'radial', cx: 10, cy: 9, r: 5, stops: gradient().stops }),
      timelines: {
        t: {
          duration: 1,
          tracks: {
            'a.fill.cx': [
              [0, 10],
              [1, 14],
            ],
            'a.fill.fy': [
              [0, 9],
              [1, 11],
            ],
          },
        },
      },
      machine: { layers: { l: { initial: 's', states: { s: { play: 't' } } } } },
    };
    const r = load(doc);
    expect(r.diagnostics).toEqual([]);
    const p = new Player(r.model!);
    p.step(0.5);
    expect(toSVG(p)).toContain('cx="12" cy="9" r="5" fx="12" fy="10"');
  });

  it('clamps crossed stop offsets for SVG while preserving sampled values', () => {
    const doc = {
      ...document(),
      timelines: {
        t: {
          duration: 1,
          tracks: {
            'a.fill.stops.0.position': [
              [0, 0],
              [1, 1],
            ],
            'a.fill.stops.1.position': [
              [0, 1],
              [1, 0],
            ],
          },
        },
      },
      machine: { layers: { l: { initial: 's', states: { s: { play: 't' } } } } },
    };
    const p = new Player(load(doc).model!);
    p.step(0.75);
    expect(p.value('a.fill.stops.1.position')).toBe(0.25);
    expect(toSVG(p).match(/offset="0.75"/g)).toHaveLength(2);
  });

  it('renders absolute/relative units and lets trim override, including a hidden stroke', () => {
    const p = casePlayer('paint-dash');
    p.step(0);
    expect(leaf(p, 0)).toMatchObject({
      pathLength: null,
      'stroke-dasharray': '2 1',
      'stroke-dashoffset': '0',
    });
    expect(leaf(p, 1)).toMatchObject({ pathLength: '1', 'stroke-dasharray': '0.1 0.05' });
    expect(leaf(p, 2)).toMatchObject({ pathLength: null, 'stroke-dasharray': '2 1' });
    p.step(0.5);
    expect(leaf(p, 0)['stroke-dashoffset']).toBe('2');
    expect(leaf(p, 1)['stroke-dashoffset']).toBe('-0.25');
    expect(leaf(p, 2)).toMatchObject({
      pathLength: '1',
      'stroke-dasharray': '0.5 0.5',
      'stroke-dashoffset': '0',
    });
    p.step(0.5);
    expect(leaf(p, 2).stroke).toBe('none');
  });

  it('preserves odd dash arrays and zero entries; offset alone has no display effect', () => {
    const p = new Player(
      load(document({ color: '#000' }, { color: '#fff', dash: [0, 2, 1], dashOffset: -2 })).model!,
    );
    expect(leaf(p, 0)).toMatchObject({ 'stroke-dasharray': '0 2 1', 'stroke-dashoffset': '-2' });
    const q = new Player(
      load(document({ color: '#000' }, { color: '#fff', dashOffset: 2 })).model!,
    );
    expect(leaf(q, 0)['stroke-dashoffset']).toBeNull();
  });

  it('marks every added schema key with the feature', () => {
    const schema = jsonSchema() as {
      $defs: {
        node: {
          oneOf: { properties: { fill?: { properties: Record<string, { feature?: string }> } } }[];
        };
      };
    };
    const fill = schema.$defs.node.oneOf.find((s) => s.properties.fill)!.properties.fill!;
    expect(fill.properties.stops?.feature).toBe('paint');
    expect(fill.properties.x1?.feature).toBe('paint');
  });
});

describe('paint diagnostics', () => {
  it.each([
    [
      'mixed colour and gradient',
      { ...gradient(), color: '#000' },
      'bad-value',
      '/nodes/0/fill/color',
    ],
    [
      'missing coordinate',
      { type: 'linear', stops: gradient().stops },
      'missing-key',
      '/nodes/0/fill',
    ],
    ['empty paint', {}, 'missing-key', '/nodes/0/fill'],
    ['wrong coordinate', { ...gradient(), cx: 2 }, 'bad-value', '/nodes/0/fill/cx'],
    ['coordinate without gradient', { color: '#000', x1: 2 }, 'bad-value', '/nodes/0/fill/x1'],
    [
      'too few stops',
      { ...gradient(), stops: [gradient().stops[0]] },
      'bad-value',
      '/nodes/0/fill/stops',
    ],
    [
      'stop range',
      {
        ...gradient(),
        stops: [
          { position: 2, color: '#000' },
          { position: 1, color: '#fff' },
        ],
      },
      'bad-value',
      '/nodes/0/fill/stops/0/position',
    ],
    [
      'unsorted stops',
      {
        ...gradient(),
        stops: [
          { position: 1, color: '#000' },
          { position: 0, color: '#fff' },
        ],
      },
      'bad-value',
      '/nodes/0/fill/stops/1/position',
    ],
    [
      'bad colour',
      {
        ...gradient(),
        stops: [
          { position: 0, color: '#nope' },
          { position: 1, color: '#fff' },
        ],
      },
      'bad-color',
      '/nodes/0/fill/stops/0/color',
    ],
    [
      'missing slot',
      {
        ...gradient(),
        stops: [
          { position: 0, color: 'missing' },
          { position: 1, color: '#fff' },
        ],
      },
      'unknown-color-slot',
      '/nodes/0/fill/stops/0/color',
    ],
    [
      'negative radius',
      { type: 'radial', cx: 1, cy: 1, r: -1, stops: gradient().stops },
      'bad-value',
      '/nodes/0/fill/r',
    ],
  ])('%s', (_name, fill, code, pointer) => {
    const r = load(document(fill as object));
    expect(r.model).toBeUndefined();
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({ code, pointer, severity: 'error' }),
    );
  });

  it.each([
    [[], 'bad-value', '/nodes/0/stroke/dash'],
    [[0, 0], 'bad-value', '/nodes/0/stroke/dash'],
    [[1, '10%'], 'bad-value', '/nodes/0/stroke/dash'],
    [[-1, 2], 'bad-value', '/nodes/0/stroke/dash/0'],
    [['-1%', '10%'], 'bad-value', '/nodes/0/stroke/dash/0'],
    [['.5%', '10%'], 'bad-value', '/nodes/0/stroke/dash/0'],
    [['1e2%', '10%'], 'bad-value', '/nodes/0/stroke/dash/0'],
  ])('invalid dash %j', (dash, code, pointer) => {
    const r = load(document({ color: '#000' }, { color: '#000', dash }));
    expect(r.model).toBeUndefined();
    expect(r.diagnostics).toContainEqual(expect.objectContaining({ code, pointer }));
  });

  it.each([
    'a.fill.stops.9.color',
    'a.fill.stops.01.color',
    'a.fill.stops.-1.position',
    'a.fill.fx',
    'a.fill.color',
  ])('rejects unknown address %s', (address) => {
    const r = load({
      ...document(),
      timelines: { t: { duration: 1, tracks: { [address]: [[0, 0]] } } },
    });
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unknown-address',
        pointer: '/timelines/t/tracks/' + address,
      }),
    );
  });

  it('rejects an undeclared module even when only the animation uses its default property', () => {
    const doc = {
      ...document({ color: '#000' }, { color: '#000' }),
      requires: [],
      timelines: { t: { duration: 1, tracks: { 'a.stroke.dashOffset': [[0, 1]] } } },
    };
    expect(load(doc).diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'undeclared-feature',
        pointer: '/timelines/t/tracks/a.stroke.dashOffset',
        hint: 'add "paint" to "requires"',
      }),
    );
  });

  it('keeps the animated slot restriction for stops, for both rest values and keys', () => {
    for (const restSlot of [false, true]) {
      const fill = gradient();
      fill.stops[0]!.color = restSlot ? 'accent' : '#f00';
      const r = load({
        ...document(fill),
        colors: { accent: '#f00' },
        timelines: { t: { duration: 1, tracks: { 'a.fill.stops.0.color': [[0, 'accent']] } } },
      });
      expect(r.diagnostics.some((d) => d.code === 'color-slot-animated')).toBe(true);
      expect(r.model).toBeUndefined();
    }
  });
});
