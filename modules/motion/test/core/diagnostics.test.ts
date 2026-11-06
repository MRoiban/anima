import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load } from '@anima-format/core';
const base = () => ({
  anima: '0.1',
  name: 'test',
  grid: 20,
  requires: ['motion'],
  nodes: [
    {
      id: 'a',
      type: 'circle',
      center: [0, 0],
      r: 1,
      fill: { color: '#000' },
      channels: { v: { type: 'int', value: 0 } },
    },
  ],
  timelines: {
    t: {
      duration: 2,
      tracks: {
        'a.channels.v': [
          [0, 0],
          [2, 1],
        ],
      },
    },
  },
});
const cases: [string, string, (d: ReturnType<typeof base>) => void][] = [
  [
    'motion-integer',
    '/timelines/t/tracks/a.channels.v/0/1',
    (d) => {
      d.timelines.t.tracks['a.channels.v'][0]![1] = 1.5;
    },
  ],
  [
    'motion-integer',
    '/nodes/0/channels/v/value',
    (d) => {
      d.nodes[0]!.channels.v.value = -2147483649;
    },
  ],
  [
    'motion-integer',
    '/nodes/0/channels/v/value',
    (d) => {
      Object.assign(d.nodes[0]!.channels.v, { type: 'uint', value: -1 });
    },
  ],
  [
    'value-type',
    '/nodes/0/channels/v/value',
    (d) => {
      Object.assign(d.nodes[0]!.channels.v, { type: 'string', value: 1 });
    },
  ],
  [
    'motion-reference',
    '/nodes/0/channels/v/value',
    (d) => {
      Object.assign(d.nodes[0]!.channels.v, { type: 'reference', value: 'missing' });
      d.timelines.t.tracks = {
        'a.channels.v': [
          [0, 0],
          [2, 1],
        ],
      };
    },
  ],
  [
    'motion-work',
    '/timelines/t/work',
    (d) => {
      Object.assign(d.timelines.t, { work: [1.5, 0.5] });
    },
  ],
  [
    'bad-ease',
    '/timelines/t/tracks/a.channels.v/0/2',
    (d) => {
      Object.assign(d.timelines.t.tracks['a.channels.v'][0]!, { 2: 'linear' });
    },
  ],
  [
    'bad-ease',
    '/timelines/t/tracks/a.channels.v/0/2',
    (d) => {
      Object.assign(d.timelines.t.tracks['a.channels.v'][0]!, { 2: 'elastic-in(1,0)' });
    },
  ],
  [
    'undeclared-feature',
    '/nodes/0/channels',
    (d) => {
      d.requires = [];
    },
  ],
];
for (const [code, pointer, edit] of cases)
  it(`diagnoses ${code} at ${pointer}`, () => {
    const doc = base();
    edit(doc);
    const r = load(doc);
    expect(r.model).toBeUndefined();
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        pointer,
        severity: 'error',
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
  });
it('diagnoses an exit without a source animation', () => {
  const doc = {
    ...base(),
    machine: {
      layers: {
        l: {
          initial: 's',
          states: {
            s: { pose: {}, on: [{ when: '@after(0)', to: 'next', exit: 1 }] },
            next: { pose: {} },
          },
        },
      },
    },
  };
  expect(load(doc).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'motion-exit',
      pointer: '/machine/layers/l/states/s/on/0/exit',
      hint: expect.any(String),
    }),
  );
});

it('keeps nested node and fractional-exit diagnostics on real JSON pointers', () => {
  const d = base();
  const child = { ...d.nodes[0]!, channels: { v: { type: 'reference', value: 'missing' } } };
  const r = load({ ...d, nodes: [{ id: 'g', type: 'group', children: [child] }], timelines: {} });
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'motion-reference',
      pointer: '/nodes/0/children/0/channels/v/value',
      hint: expect.any(String),
    }),
  );
  const doc = {
    ...d,
    machine: {
      layers: {
        l: {
          initial: 's',
          states: {
            s: { pose: {}, on: [{ when: '@after(0)', to: 'next', exitFraction: 0.5 }] },
            next: { pose: {} },
          },
        },
      },
    },
  };
  expect(load(doc).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'motion-exit',
      pointer: '/machine/layers/l/states/s/on/0/exitFraction',
    }),
  );
});
