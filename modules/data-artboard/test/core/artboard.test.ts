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

it('diagnoses incompatible inherited foreign model properties before rebinding', () => {
  const p = make(),
    raw = doc();
  const source = make({
    ...raw,
    data: {
      ...raw.data,
      models: {
        Card: {
          properties: {
            ...raw.data.models.Card.properties,
            radius: { type: 'string', default: 'wrong' },
          },
        },
      },
    },
    components: { ...raw.components, front: { ...raw.components.front, bind: {} } },
  });
  p.data.artboard('content').set(component(source.model, 'front'));
  expect(() => p.step(0)).toThrowError(
    expect.objectContaining({
      code: 'artboard-model',
      pointer: '/data/$content',
      message: expect.stringContaining('incompatible'),
      hint: expect.stringContaining('matching data'),
    }),
  );
});

it('checks explicit placement data against the assigned component schema', () => {
  const raw = doc(),
    source = make(raw);
  const p = make({
    ...raw,
    data: {
      ...raw.data,
      models: {
        ...raw.data.models,
        Wrong: {
          properties: {
            content: { type: 'artboard', default: '' },
            radius: { type: 'string', default: 'bad' },
          },
        },
      },
      instances: { ...raw.data.instances, other: { model: 'Wrong', values: {} } },
    },
    nodes: [{ id: 'content', type: 'instance', component: '$content', data: 'other' }],
    components: { ...raw.components, front: { ...raw.components.front, bind: {} } },
  });
  p.data.artboard('content').set(component(source.model, 'front'));
  expect(() => p.step(0)).toThrowError(expect.objectContaining({ code: 'artboard-model' }));
});

it('permits a foreign component with independent model data', () => {
  const raw = doc(),
    p = make();
  const source = make({
    ...raw,
    components: {
      ...raw.components,
      independent: {
        grid: 20,
        data: {
          models: { Own: { properties: { title: { type: 'string', default: 'independent' } } } },
        },
        nodes: [{ id: 'own', type: 'circle', center: [5, 5], r: 4 }],
      },
    },
  });
  p.data.artboard('content').set(component(source.model, 'independent'));
  p.step(0);
  expect(ids(p)).toContain('content/own');
});

it('respects the artboard property expected model for an independently modeled component', () => {
  const raw = doc();
  const p = make({
    ...raw,
    data: {
      ...raw.data,
      models: {
        Card: {
          properties: {
            ...raw.data.models.Card.properties,
            content: { type: 'artboard', default: 'front', model: 'Card' },
          },
        },
      },
    },
  });
  const source = make({
    ...raw,
    nodes: [{ id: 'root', type: 'group', children: [] }],
    components: {
      ...raw.components,
      wrong: {
        grid: 20,
        data: { models: { Other: { properties: { radius: { type: 'string', default: 'bad' } } } } },
        nodes: [{ id: 'empty', type: 'group', children: [] }],
      },
    },
  });
  p.data.artboard('content').set(component(source.model, 'wrong'));
  expect(() => p.step(0)).toThrowError(
    expect.objectContaining({ code: 'artboard-model', pointer: '/data/$content' }),
  );
});

it('validates enum, nested model and list element contracts', () => {
  const schema = (radius: string, members = ['a', 'b']) => ({
    instances: { main: { model: 'Card', default: true, values: {} } },
    models: {
      Card: {
        properties: {
          content: { type: 'artboard', default: 'front' },
          child: { type: 'model-ref', model: 'Child' },
          items: { type: 'list', of: 'Child' },
          mode: { type: 'enum', values: members },
        },
      },
      Child: { properties: { radius: { type: radius } } },
    },
  });
  const raw = doc();
  const target = () =>
    make({
      ...raw,
      data: schema('number'),
      components: { ...raw.components, front: { ...raw.components.front, bind: {} } },
    });
  const source = (data: object) =>
    make({
      ...raw,
      data,
      components: { ...raw.components, front: { ...raw.components.front, bind: {} } },
    });
  for (const data of [schema('string'), schema('number', ['a', 'c'])]) {
    const p = target();
    p.data.bind(p.data.instances()[0]!);
    p.data.artboard('content').set(component(source(data).model, 'front'));
    expect(() => p.step(0)).toThrowError(expect.objectContaining({ code: 'artboard-model' }));
  }
  const base = schema('number');
  const listMismatch = {
    ...base,
    models: {
      ...base.models,
      Card: {
        properties: { ...base.models.Card.properties, items: { type: 'list', of: 'Other' } },
      },
      Other: { properties: { radius: { type: 'string' } } },
    },
  };
  const p = target();
  p.data.artboard('content').set(component(source(listMismatch).model, 'front'));
  expect(() => p.step(0)).toThrowError(expect.objectContaining({ code: 'artboard-model' }));
  const compatible = target();
  compatible.data
    .artboard('content')
    .set(component(source(schema('number', ['b', 'a'])).model, 'front'));
  compatible.step(0);
  expect(ids(compatible)).toContain('content/front');
});

it('validates shared named instances before foreign bindings can consume incompatible values', () => {
  const raw = doc();
  const document = (type: string, value: unknown, foreign = false) => ({
    ...raw,
    data: {
      ...raw.data,
      models: { ...raw.data.models, Other: { properties: { value: { type } } } },
      instances: { ...raw.data.instances, shared: { model: 'Other', values: { value } } },
    },
    nodes: foreign ? [{ id: 'root', type: 'group', children: [] }] : raw.nodes,
    components: {
      ...raw.components,
      front: {
        ...raw.components.front,
        bind: foreign ? { 'front.r': '$shared:value' } : raw.components.front.bind,
      },
    },
  });
  const source = make(document('number', 7, true));
  const p = make(document('string', 'bad'));
  p.data.artboard('content').set(component(source.model, 'front'));
  expect(() => p.step(0)).toThrowError(
    expect.objectContaining({ code: 'artboard-model', pointer: '/data/$content' }),
  );
  const compatible = make(document('number', 5));
  compatible.data.artboard('content').set(component(source.model, 'front'));
  compatible.step(0);
  expect(compatible.values()['content/front.r']).toBe(5);
});

it('R1-6: prunes retired external assignments without extending shared schemas', async () => {
  const { assignments } = await import('../../core/index.ts');
  const { data } = await import('../../../data/core/index.ts');
  const p = make(),
    q = new Player(p.model);
  q.data.bind('main');
  q.step(0);
  const schema = JSON.stringify(data.compiled.get(p.model)!.document);
  const sources = [make(), make(), make()];
  for (const source of sources) {
    p.data.artboard('content').set(component(source.model, 'back'));
    p.step(0);
    expect([...assignments.get(p)!.values()]).toEqual([
      (p.nested as typeof p.nested & { players: Map<string, Player> })!.players.get('content')!
        .model,
    ]);
    expect(JSON.stringify(data.compiled.get(p.model)!.document)).toBe(schema);
  }
  const alias = p.data.artboard('content').value;
  expect(() => q.data.artboard('content').set(alias)).toThrow();
  p.data.artboard('content').set('');
  p.step(0);
  expect(assignments.get(p)!.size).toBe(0);
  expect(() => p.pointer('move', 0, 0)).not.toThrow();
  expect(
    (p.nested as typeof p.nested & { players: Map<string, Player> })!.players.has('content'),
  ).toBe(false);
});

it('R1-6: keeps queued selections until commit, then retains only the final selection', async () => {
  const { assignments } = await import('../../core/index.ts');
  const p = make();
  for (const source of [make(), make(), make()])
    p.data.artboard('content').set(component(source.model, 'back'));
  expect(assignments.get(p)!.size).toBe(3);
  p.step(0);
  expect(assignments.get(p)!.size).toBe(1);
  p.data.artboard('content').set('front');
  p.step(0);
  expect(assignments.get(p)!.size).toBe(0);
});

it('R1-6: preserves duplicate aliases queued for a later step', async () => {
  const { assignments } = await import('../../core/index.ts');
  const p = make(),
    h = p.data.artboard('content');
  const foreign = component(make().model, 'back');
  p.data.enqueue(() => h.set(foreign));
  h.set(foreign);
  h.set('front');
  p.step(0);
  expect(assignments.get(p)!.size).toBe(1);
  expect(() => p.step(0)).not.toThrow();
  expect(ids(p)).toContain('content/back');
});
it('R1-6: prunes player-local assignments even when nesting declines', async () => {
  const { assignments } = await import('../../core/index.ts');
  const p = make({
    ...doc(),
    nodes: [{ id: 'tile', type: 'rect', x0: 0, y0: 0, w: 2, h: 2, fill: { color: '#000' } }],
  });
  for (const source of [make(), make(), make()]) {
    p.data.artboard('content').set(component(source.model, 'back'));
    p.step(0);
    expect(assignments.get(p)!.size).toBe(1);
  }
  p.data.artboard('content').set('');
  p.step(0);
  expect(assignments.get(p)!.size).toBe(0);
});

it('R1-6: retired aliases never name a later external assignment', async () => {
  const p = make(),
    h = p.data.artboard('content');
  const aliases: string[] = [];
  for (const source of [make(), make(), make()]) {
    h.set(component(source.model, 'back'));
    p.step(0);
    aliases.push(String(h.value));
  }
  expect(new Set(aliases).size).toBe(3);
  expect(() => h.set(aliases[0]!)).toThrow(expect.objectContaining({ code: 'unknown-component' }));
});
