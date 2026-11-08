import '../../../../packages/core/src/all.ts';
import { expect, it } from 'vitest';
import { load, Player, drawFrame } from '../../../../packages/core/src/index.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
import { component } from '../../core/index.ts';
import { lists } from '../../../lists/core/index.ts';
const requires = ['components', 'data', 'nested', 'host', 'dataartboard', 'bind'];
export const doc = () => ({
  anima: '0.1',
  name: 'card',
  grid: 20,
  requires,
  data: {
    models: {
      Card: {
        properties: {
          content: { type: 'artboard', default: 'front' },
          radius: { type: 'number', default: 2 },
        },
      },
    },
    instances: { main: { model: 'Card', default: true, values: {} } },
  },
  components: {
    front: {
      grid: 20,
      nodes: [{ id: 'front', type: 'circle', center: [5, 5], r: 1, fill: { color: '#f00' } }],
      bind: { 'front.r': '$radius' },
    },
    back: {
      grid: 20,
      nodes: [{ id: 'back', type: 'rect', x0: 1, y0: 1, w: 3, h: 4, fill: { color: '#00f' } }],
      bind: { 'back.w': '3' },
    },
  },
  nodes: [{ id: 'content', type: 'instance', component: '$content' }],
});
export function make(raw: object = doc()) {
  const r = load(raw);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  p.data.bind('main');
  p.step(0);
  return p;
}
const ids = (p: Player) =>
  drawFrame(p)
    .tree.nodes.filter((_, i) => drawFrame(p).nodes[i]?.visible)
    .map((n) => n.id);
it('compiles the artboard type through both document syntaxes without rewriting the source', () => {
  const raw = doc(),
    p = make(raw);
  expect(raw.data.models.Card.properties.content.type).toBe('artboard');
  expect(p.model.doc.data.models.Card.properties.content.type).toBe('artboard');
  const text = decompile(raw);
  const result = compile(text);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect(result.doc?.data).toEqual(raw.data);
});
it('queues a local swap, retains same selection state and isolates players', () => {
  const p = make(),
    q = make();
  const nested = p.nested as unknown as { players: Map<string, Player> };
  const initial = nested.players.get('content');
  p.data.artboard('content').set('front');
  p.step(0);
  expect(nested.players.get('content')).toBe(initial);
  p.data.artboard('content').set('back');
  expect(ids(p)).toContain('content/front');
  p.step(0);
  expect(ids(p)).toContain('content/back');
  expect(ids(q)).toContain('content/front');
  p.data.artboard('content').set('');
  p.step(0);
  expect(ids(p)).not.toContain('content/back');
});
it('assigns a component from another loaded lexical document', () => {
  const p = make();
  const source = make({
    ...doc(),
    components: {
      foreign: {
        grid: 20,
        nodes: [{ id: 'external', type: 'circle', center: [9, 9], r: 4, fill: { color: '#0f0' } }],
      },
    },
    data: {
      models: {
        Card: {
          properties: {
            content: { type: 'artboard', default: 'foreign' },
            radius: { type: 'number', default: 2 },
          },
        },
      },
      instances: { main: { model: 'Card', default: true, values: {} } },
    },
  });
  p.data.artboard('content').set(component(source.model, 'foreign'));
  p.step(0);
  expect(ids(p)).toContain('content/external');
});
it('diagnoses invalid handles, unknown names and missing external documents', () => {
  const p = make();
  for (const [run, code] of [
    [() => p.data.artboard('radius'), 'data-type'],
    [() => p.data.artboard('content').set('missing'), 'unknown-component'],
    [() => p.data.artboard('content').set({ name: 'front' } as never), 'artboard-document'],
    [() => p.data.artboard('content').set(component(p.model, 'missing')), 'unknown-component'],
  ] as const) {
    let error: unknown;
    try {
      run();
    } catch (e) {
      error = e;
    }
    expect(error).toMatchObject({
      code,
      pointer: expect.stringMatching(/^\/data\//),
      hint: expect.any(String),
      message: expect.any(String),
    });
  }
});
it('diagnoses authored unknown selections and wrong binding types', () => {
  const raw = doc();
  raw.data.models.Card.properties.content.default = 'missing';
  expect(load(raw).diagnostics).toContainEqual(
    expect.objectContaining({ code: 'unknown-component' }),
  );
  const other = doc();
  other.nodes[0]!.component = '$radius';
  expect(load(other).diagnostics).toContainEqual(
    expect.objectContaining({ code: 'component-path', pointer: '/nodes/0/component' }),
  );
});
it('swaps inside repeated model contexts without replacing unrelated items', () => {
  const raw = doc();
  const p = make({
    ...raw,
    requires: [...raw.requires, 'lists'],
    data: {
      models: {
        Card: { properties: { items: { type: 'list', of: 'Cell' } } },
        Cell: {
          properties: {
            content: { type: 'artboard', default: 'front' },
            radius: { type: 'number', default: 2 },
          },
        },
      },
      instances: {
        main: { model: 'Card', default: true, values: { items: [{ radius: 3 }, { radius: 5 }] } },
      },
    },
    components: {
      ...raw.components,
      row: {
        grid: 20,
        data: 'Cell',
        nodes: [{ id: 'body', type: 'instance', component: '$content' }],
      },
    },
    nodes: [{ id: 'rows', type: 'repeat', list: '$items', component: 'row', dx: 10 }],
  });
  expect(p.values()['rows/0/body/front.r']).toBe(3);
  expect(p.values()['rows/1/body/front.r']).toBe(5);
  p.data.artboard('items.0.content').set('back');
  p.step(0);
  expect(p.values()['rows/0/body/back.w']).toBe(3);
  expect(p.values()['rows/1/body/front.r']).toBe(5);
});
it('keeps external identities deterministic across unrelated players', () => {
  const p = make(),
    q = make(),
    other = make();
  const first = component(make().model, 'back');
  p.data.artboard('content').set(first);
  p.step(0);
  other.data.artboard('content').set(component(make().model, 'front'));
  other.step(0);
  q.data.artboard('content').set(first);
  q.step(0);
  expect(p.get('$content')).toBe(q.get('$content'));
});
it('isolates external selections for players sharing a compiled model', () => {
  const p = make(),
    q = new Player(p.model);
  q.data.bind('main');
  q.step(0);
  p.data.artboard('content').set(component(make().model, 'back'));
  p.step(0);
  q.data.artboard('content').set(component(make().model, 'front'));
  q.step(0);
  p.step(0);
  expect(ids(p)).toContain('content/back');
  expect(ids(q)).toContain('content/front');
});
it('accepts comments in model declarations while normalizing artboard types', () => {
  const raw = doc();
  make({ ...raw, data: { ...raw.data, models: { ...raw.data.models, $comment: 'schema note' } } });
});
it('rebinds an external component to the explicit placement data', () => {
  const p = make({
    ...doc(),
    nodes: [{ id: 'content', type: 'instance', component: '$content', data: 'main' }],
  });
  const raw = doc();
  raw.data.models.Card.properties.radius.default = 9;
  const source = make(raw);
  p.data.artboard('content').set(component(source.model, 'front'));
  p.step(0);
  expect(p.values()['content/front.r']).toBe(2);
  p.data.number('radius').set(4);
  p.step(0);
  expect(p.values()['content/front.r']).toBe(4);
});

it('rejects recursive host selections at the eight-level component limit', () => {
  const raw = doc();
  const p = make({
    ...raw,
    components: {
      ...raw.components,
      loop: { grid: 20, nodes: [{ id: 'recursive', type: 'instance', component: '$content' }] },
    },
  });
  p.data.artboard('content').set(component(p.model, 'loop'));
  let error: unknown;
  try {
    p.step(0);
  } catch (e) {
    error = e;
  }
  expect(error).toMatchObject({
    code: 'limit-exceeded',
    pointer: expect.stringMatching(/^\/data\//),
    hint: expect.any(String),
  });
});
it('keeps qualified-name aliases from the existing component host handle', () => {
  const raw = doc();
  const p = make({ ...raw, meta: { componentNames: { short: 'back' } } });
  p.data.artboard('content').set('short');
  p.step(0);
  expect(ids(p)).toContain('content/back');
});
it('uses outer artboard values inside an external component under its inherited model data', () => {
  const raw = doc();
  const properties = {
    ...raw.data.models.Card.properties,
    other: { type: 'artboard', default: 'front' },
  };
  const p = make({ ...raw, data: { ...raw.data, models: { Card: { properties } } } });
  const source = make({
    ...raw,
    data: { ...raw.data, models: { Card: { properties } } },
    components: {
      ...raw.components,
      wrapper: { grid: 20, nodes: [{ id: 'inner', type: 'instance', component: '$other' }] },
    },
  });
  p.data.artboard('content').set(component(source.model, 'wrapper'));
  p.data.artboard('other').set(component(source.model, 'back'));
  p.step(0);
  expect(ids(p)).toContain('content/inner/back');
});
it('accepts an external-first slot with no local component definitions', () => {
  const raw = doc();
  const p = make({
    ...raw,
    components: {},
    data: {
      ...raw.data,
      models: {
        Card: {
          properties: {
            ...raw.data.models.Card.properties,
            content: { type: 'artboard', default: '' },
          },
        },
      },
    },
  });
  p.data.artboard('content').set(component(make().model, 'back'));
  p.step(0);
  expect(ids(p)).toContain('content/back');
});
it('shares an assignment from a descendant handle with all consumers of the same model data', () => {
  const raw = doc();
  const p = make({
    ...raw,
    data: {
      ...raw.data,
      models: {
        Card: {
          properties: {
            ...raw.data.models.Card.properties,
            other: { type: 'artboard', default: 'front' },
          },
        },
      },
    },
    components: {
      ...raw.components,
      wrapper: { grid: 20, nodes: [{ id: 'inner', type: 'instance', component: '$other' }] },
    },
    nodes: [
      { id: 'wrapper', type: 'instance', component: 'wrapper' },
      { id: 'direct', type: 'instance', component: '$other' },
    ],
  });
  const child = (p.nested as unknown as { players: Map<string, Player> }).players.get('wrapper')!;
  child.data.bind('main');
  child.data.artboard('other').set(component(make().model, 'back'));
  p.step(0);
  p.step(0);
  expect(ids(p)).toContain('wrapper/inner/back');
  expect(ids(p)).toContain('direct/back');
});
it('routes a repeated-item handle through its owning root without leaking to another root', () => {
  const raw = doc();
  const document = {
    ...raw,
    requires: [...raw.requires, 'lists'],
    data: {
      models: {
        Card: { properties: { items: { type: 'list', of: 'Cell' } } },
        Cell: { properties: raw.data.models.Card.properties },
      },
      instances: { main: { model: 'Card', default: true, values: { items: [{ radius: 3 }] } } },
    },
    components: {
      ...raw.components,
      row: {
        grid: 20,
        data: 'Cell',
        nodes: [{ id: 'body', type: 'instance', component: '$content' }],
      },
    },
    nodes: [{ id: 'rows', type: 'repeat', component: 'row', list: '$items' }],
  };
  const p = make(document),
    q = new Player(p.model);
  q.data.bind('main');
  q.step(0);
  const item = lists.listState(p)!.runs[0]!.items[0]!.player;
  item.data.bind(item.data.instances().find((instance) => instance.model === 'Cell')!);
  item.data.artboard('content').set(component(make().model, 'front'));
  p.step(0);
  p.step(0);
  q.step(0);
  expect(p.values()['rows/0/body/front.r']).toBe(3);
  expect(ids(q)).toContain('rows/0/body/front');
});
it('keeps invalid cyclic defaults on the normal diagnostic path', () => {
  const raw = doc(),
    cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  const document = {
    ...raw,
    data: {
      ...raw.data,
      models: {
        Card: {
          properties: {
            ...raw.data.models.Card.properties,
            radius: { type: 'number', default: cycle },
          },
        },
      },
    },
  };
  expect(() => load(document)).not.toThrow();
  expect(load(document).diagnostics).toContainEqual(expect.objectContaining({ code: 'data-type' }));
});
