import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player, drawFrame, toSVG } from '../../../../packages/core/src/index.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
import { dataState } from '../../../data/core/index.ts';
import { listState } from '../../core/index.ts';
import { readFileSync } from 'node:fs';
export const source = readFileSync(
  new URL('../../examples/players.animl', import.meta.url),
  'utf8',
);
import type { Document } from './document.ts';
const doc = () => compile(source).doc! as unknown as Document;
function player(input: object = doc()) {
  const result = load(input);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(result.model!);
}
it('compiles both spellings, renders retained slots, and isolates root players', () => {
  const document = doc();
  expect(compile(decompile(document)).doc).toEqual(document);
  const p = player(document),
    other = new Player(p.model);
  p.step(0);
  other.step(0);
  expect(p.values()).toMatchObject({
    'rows/0/dot.r': 3,
    'rows/1/dot.r': 7,
    'rows/1/dot.x': 1,
    'rows/0/dot.y': 2,
  });
  p.set('$players.0.score', 5);
  p.step(0);
  expect(p.values()['rows/0/dot.r']).toBe(5);
  expect(other.values()['rows/0/dot.r']).toBe(3);
  expect(toSVG(p)).toContain('r="5"');
  const f = drawFrame(p);
  expect(f.tree.nodes.filter((n) => n.kind === 'group').length).toBeGreaterThan(2);
});
it('preserves player, clocks and queued state across insert/remove/swap, including duplicates', () => {
  const document = doc();
  const row = document.components.row!;
  row.inputs = { clicks: { type: 'number' }, go: { type: 'trigger' } };
  row.machine = {
    layers: {
      selection: {
        initial: 'idle',
        states: {
          idle: { pose: {}, on: [{ when: 'go', to: 'selected' }] },
          selected: { pose: { 'dot.scale': 0.5 } },
        },
      },
    },
  };
  row.bind['dot.opacity'] = 'clicks';
  const p = player(document);
  p.step(0);
  const run = listState(p)!.runs[0]!;
  const [first, second] = run.items.map((i) => i.player);
  first!.set('clicks', 0.4);
  first!.fire('go');
  const list = dataState(p)!.read('$players') as object[];
  list.reverse();
  p.step(0.25);
  expect(run.items.map((i) => i.player)).toEqual([second, first]);
  expect(first!.time).toBe(0.25);
  expect(p.values()['rows/1/dot.opacity']).toBe(0.4);
  expect(p.states()['rows/1/selection']).toBe('selected');
  expect(p.values()['rows/1/dot.scale']).toBe(0.5);
  expect(p.values()['rows/0/dot.x']).toBe(0);
  const added = { score: 11 };
  dataState(p)!.modelTypes!.set(added, 'Player');
  list.splice(1, 0, added);
  p.step(0);
  expect(run.items[0]!.player).toBe(second);
  expect(run.items[2]!.player).toBe(first);
  list.splice(0, 1);
  p.step(0);
  expect(run.items[1]!.player).toBe(first);
  expect(p.states()['rows/1/selection']).toBe('selected');
  list.push(list[1]!);
  p.step(0);
  expect(run.items[2]!.player).not.toBe(first);
  expect(run.items[1]!.player).toBe(first);
});
it('count repeats retain indices and state when growing, discard removed indices', () => {
  const document = doc();
  document.data.models.Board!.properties.n = { type: 'number', default: 2 };
  document.nodes[0] = { id: 'stars', type: 'repeat', count: '$n', component: 'row' };
  delete document.components.row!.bind['dot.r'];
  const p = player(document);
  p.step(0);
  const run = listState(p)!.runs[0]!,
    first = run.items[0]!.player,
    second = run.items[1]!.player;
  p.set('$n', 3.8);
  p.step(0);
  expect(run.items).toHaveLength(3);
  expect(run.items[0]!.player).toBe(first);
  p.set('$n', 1);
  p.step(0);
  expect(run.items).toHaveLength(1);
  p.set('$n', 2);
  p.step(0);
  expect(run.items[0]!.player).toBe(first);
  expect(run.items[1]!.player).not.toBe(second);
  p.set('$n', -2);
  p.step(0);
  expect(run.items).toHaveLength(0);
});
it('selects mixed model components and records unmapped dynamic model warnings', () => {
  const document = doc();
  delete document.data.models.Board!.properties.players!.of;
  document.data.models.Header = { properties: { score: { type: 'number' } } };
  document.data.instances.main!.values.players = [
    { model: 'Player', values: { score: 3 } },
    { model: 'Header', values: { score: 9 } },
  ];
  document.components.header = {
    grid: 10,
    data: 'Header',
    nodes: [{ id: 'dot', type: 'circle', center: [2, 2], r: 1 }],
    bind: { 'dot.r': '$score' },
  };
  document.nodes[0]!.component = { Player: 'row', Header: 'header' };
  const p = player(document);
  p.step(0);
  expect(p.values()['rows/1/dot.r']).toBe(9);
  const list = dataState(p)!.read('$players') as object[];
  const unknown = {};
  list.push(unknown);
  dataState(p)!.modelTypes!.set(unknown, 'Other');
  p.step(0);
  expect(listState(p)!.runs[0]!.items).toHaveLength(2);
  expect(listState(p)!.warnings[0]).toMatchObject({
    code: 'list-map',
    pointer: '/nodes/0/component',
    severity: 'warning',
    message: expect.any(String),
    hint: expect.any(String),
  });
  const xml = decompile(document).replace(
    /component="[^"]*Player[^"]*"/,
    'component="Player:row Header:header"',
  );
  expect(compile(xml).doc).toEqual(document);
});
it('binds explicit nested references and inherited grandchildren with two parent levels', () => {
  const document = doc();
  document.data.models.Player!.properties.team = { type: 'model-ref', model: 'Team' };
  document.data.models.Team = { properties: { points: { type: 'number', default: 8 } } };
  document.components.team = {
    grid: 10,
    data: 'Team',
    nodes: [{ id: 'dot', type: 'circle', center: [1, 1], r: 1 }],
    bind: { 'dot.r': '$points', 'dot.x': '$parent.score', 'dot.y': '$parent.parent.bonus' },
  };
  document.components.inherit = {
    grid: 10,
    nodes: [{ id: 'dot', type: 'circle', center: [1, 1], r: 1 }],
    bind: { 'dot.r': '$score', 'dot.x': '$parent.score' },
  };
  document.components.row!.nodes.push(
    { id: 'team', type: 'instance', component: 'team', data: '$team' },
    { id: 'inherit', type: 'instance', component: 'inherit' },
  );
  const p = player(document);
  p.step(0);
  expect(p.values()).toMatchObject({
    'rows/0/team/dot.r': 8,
    'rows/0/team/dot.x': 3,
    'rows/0/team/dot.y': 2,
    'rows/1/inherit/dot.r': 7,
    'rows/1/inherit/dot.x': 7,
  });
});
for (const [mutate, code, pointer] of [
  [
    (d: Document) => {
      d.nodes[0]!.count = '$bonus';
    },
    'list-source',
    '/nodes/0',
  ],
  [
    (d: Document) => {
      d.nodes[0]!.list = '$bonus';
    },
    'list-source',
    '/nodes/0/list',
  ],
  [
    (d: Document) => {
      d.nodes[0]!.component = { Board: 'row' };
    },
    'list-map',
    '/nodes/0/component',
  ],
  [
    (d: Document) => {
      d.data.models.Player!.properties.index = { type: 'number' };
    },
    'reserved-name',
    '/data/models/Player/properties/index',
  ],
  [
    (d: Document) => {
      d.data.models.Player!.properties.parent = { type: 'number' };
    },
    'reserved-name',
    '/data/models/Player/properties/parent',
  ],
  [
    (d: Document) => {
      d.nodes[0] = { id: 'one', type: 'instance', component: 'row', data: '$bonus' };
    },
    'data-instance',
    '/nodes/0/data',
  ],
] as const)
  it('diagnostic ' + code + ' at ' + pointer, () => {
    const document = doc();
    mutate(document);
    expect(load(document).diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        pointer,
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
  });
it('supports nested repeats without reserving exponential geometry and releases/reuses draw slots', () => {
  const document = doc();
  document.data.models.Player!.properties.children = { type: 'list', of: 'PlayerLeaf' };
  document.data.models.PlayerLeaf = { properties: { score: { type: 'number' } } };
  document.data.instances.main!.values.players = [
    { score: 3, children: [{ score: 4 }, { score: 5 }] },
    { score: 7, children: [{ score: 8 }] },
  ];
  document.components.leaf = {
    grid: 5,
    data: 'PlayerLeaf',
    nodes: [{ id: 'dot', type: 'circle', center: [1, 1], r: 1, fill: { color: '#000' } }],
    bind: { 'dot.r': '$score', 'dot.x': '$parent.score', 'dot.y': '$parent.parent.bonus' },
  };
  document.components.row!.nodes.push({
    id: 'inner',
    type: 'repeat',
    list: '$children',
    component: 'leaf',
    dx: 2,
  });
  const p = player(document);
  p.step(0);
  expect(p.values()).toMatchObject({
    'rows/0/inner/0/dot.r': 4,
    'rows/0/inner/1/dot.r': 5,
    'rows/1/inner/0/dot.r': 8,
    'rows/1/inner/0/dot.x': 7,
    'rows/1/inner/0/dot.y': 2,
  });
  const size = drawFrame(p).tree.nodes.length;
  expect(size).toBeLessThan(30);
  const children = dataState(p)!.read('$players.0.children') as object[];
  const removed = children.pop()!;
  p.step(0);
  const smaller = toSVG(p);
  expect(smaller).not.toContain('r="5"');
  children.unshift(removed);
  p.step(0);
  expect(drawFrame(p).tree.nodes.length).toBe(size);
  expect(p.values()['rows/0/inner/0/dot.r']).toBe(5);
});
it('writes scoped inputs before the first step and rejects index writes and oversized counts', () => {
  const document = doc();
  document.components.row!.inputs = { clicks: { type: 'number' } };
  document.components.row!.bind['dot.opacity'] = 'clicks';
  const p = player(document);
  p.set('rows.1.clicks', 0.6);
  p.step(0);
  expect(p.values()['rows/1/dot.opacity']).toBe(0.6);
  expect(() => listState(p)!.runs[0]!.items[0]!.player.set('$index', 2)).toThrow('read-only-path');
  document.data.models.Board!.properties.n = { type: 'number', default: 257 };
  document.nodes[0] = { id: 'rows', type: 'repeat', count: '$n', component: 'row' };
  expect(load(document).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'limit-exceeded',
      pointer: '/nodes/0',
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
  document.data.models.Board!.properties.n.default = 2;
  const q = player(document);
  q.set('$n', 257);
  expect(() => q.step(0)).toThrow(
    expect.objectContaining({
      code: 'limit-exceeded',
      pointer: '/nodes/0',
      hint: expect.any(String),
    }),
  );
});
it('retains mixed model identity when a component shares an enclosing data graph', () => {
  const document = doc();
  delete document.data.models.Board!.properties.players!.of;
  document.data.models.Header = { properties: { score: { type: 'number' } } };
  document.data.instances.main!.values.players = [
    { model: 'Player', values: { score: 3 } },
    { model: 'Header', values: { score: 9 } },
  ];
  document.components.header = {
    grid: 10,
    data: 'Header',
    nodes: [{ id: 'dot', type: 'circle', center: [2, 2], r: 1, fill: { color: '#000' } }],
    bind: { 'dot.r': '$score' },
  };
  document.components.container = {
    grid: 30,
    nodes: [
      {
        id: 'rows',
        type: 'repeat',
        list: '$players',
        component: { Player: 'row', Header: 'header' },
      },
    ],
    bind: {},
  };
  document.nodes = [{ id: 'container', type: 'instance', component: 'container', data: 'main' }];
  const p = player(document);
  p.step(0);
  expect(p.values()).toMatchObject({ 'container/rows/0/dot.r': 3, 'container/rows/1/dot.r': 9 });
});
