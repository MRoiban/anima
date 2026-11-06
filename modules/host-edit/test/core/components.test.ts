import { it, expect } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
import '../../../../packages/core/src/all.ts';
const document = () => ({
  anima: '0.1',
  name: 'component-host',
  grid: 20,
  requires: ['components', 'nested', 'data'],
  data: {
    models: {
      Card: {
        properties: { card: { type: 'component', default: 'row' }, text: { type: 'string' } },
      },
    },
    instances: {
      main: { model: 'Card', default: true },
      other: { model: 'Card', values: { card: 'box' } },
    },
  },
  components: {
    row: {
      grid: 10,
      inputs: { count: { type: 'number', default: 3 } },
      nodes: [{ id: 'dot', type: 'circle', center: [5, 5], r: 2 }],
    },
    box: { grid: 10, nodes: [{ id: 'rect', type: 'rect', x0: 0, y0: 0, w: 4, h: 4 }] },
  },
  nodes: [
    { id: 'badge', type: 'instance', component: '$card' },
    { id: 'fixed', type: 'instance', component: 'row' },
  ],
});
function player() {
  const r = load(document());
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  p.data.bind('main');
  return p;
}
const children = (p: Player) => (p.nested as unknown as { players: Map<string, Player> }).players;
it('component handle queues a validated selection, rebuilds only its consumer and isolates roots', () => {
  const p = player(),
    b = new Player(p.model);
  b.data.bind('main');
  p.step(0);
  b.step(0);
  const a = p.data,
    card = a.component('card'),
    first = children(p).get('badge'),
    fixed = children(p).get('fixed');
  const seen: string[] = [];
  card.on('change', (value) => seen.push(value));
  card.set('box');
  expect(card.value).toBe('row');
  expect(p.busy).toBe(true);
  p.step(0);
  expect(card.value).toBe('box');
  expect(children(p).get('badge')!.model.nodes[0]!.raw.w).toBe(4);
  expect(children(p).get('badge')).not.toBe(first);
  expect(children(p).get('fixed')).toBe(fixed);
  expect(b.data.component('card').value).toBe('row');
  expect(seen).toEqual(['box']);
  const box = children(p).get('badge');
  card.set('box');
  p.step(0);
  expect(children(p).get('badge')).toBe(box);
  card.set('');
  p.step(0);
  card.set('box');
  p.step(0);
  expect(children(p).get('badge')).not.toBe(box);
});
it('uses shared FIFO and callbacks wait for the next step; retained handle follows binding', () => {
  const p = player(),
    api = p.data,
    h = api.component('card');
  h.on('change', (value) => {
    if (value === 'box') h.set('row');
  });
  api.batch(() => {
    h.set('box');
    api.enqueue(() => {
      expect(h.value).toBe('box');
    });
  });
  expect(p.step(0).settled).toBe(false);
  expect(h.value).toBe('box');
  p.step(0);
  expect(h.value).toBe('row');
  api.bind('other');
  expect(h.value).toBe('box');
  expect(api.component('$main:card').value).toBe('row');
});
it('creates and replaces component-valued model instances with the original component vocabulary', () => {
  const p = player();
  const replacement = p.data.create('Card', { card: 'box' });
  p.data.bind(replacement);
  p.step(0);
  expect(children(p).get('badge')!.model.nodes[0]!.raw.w).toBe(4);
});
it.each([
  ['wrong handle', (p: Player) => p.data.component('text')],
  ['unknown path', (p: Player) => p.data.component('missing')],
  ['unknown component', (p: Player) => p.data.component('card').set('missing')],
  ['wrong value', (p: Player) => p.data.component('card').set(3 as unknown as string)],
  ['invalid create', (p: Player) => p.data.create('Card', { card: 'missing' })],
] as const)('diagnoses %s with code, pointer, message and hint', (_label, act) => {
  try {
    act(player());
    expect.fail('expected diagnostic');
  } catch (e) {
    const d = e as { code: string; pointer: string; message: string; hint: string };
    expect(d.code).toBe(
      _label === 'invalid create'
        ? 'unknown-component'
        : _label === 'unknown path'
          ? 'data-path'
          : 'data-type',
    );
    expect(d.pointer).toMatch(/^\//);
    expect(d.message).toBeTruthy();
    expect(d.hint).toBeTruthy();
  }
});
it('records native host-component command limits while matching initial selection', async () => {
  const { readFileSync } = await import('node:fs');
  const base = new URL('../../oracle/p5b8-component/', import.meta.url);
  const native = JSON.parse(readFileSync(new URL('frames/initial.json', base), 'utf8'));
  const p = player();
  p.data.component('card').set(native.nested[0].artboard);
  p.step(0);
  expect(children(p).get('badge')!.model.nodes[0]!.type).toBe('rect');
  const session = readFileSync(new URL('session.txt', base), 'utf8');
  expect(session.match(/err data: card: no property at this path/g)).toHaveLength(2);
});
it('retains component item handles across list moves and queued edits', () => {
  const d = document();
  Object.assign(d.data.models.Card.properties, { items: { type: 'list', of: 'Cell' } });
  Object.assign(d.data.models, {
    Cell: { properties: { card: { type: 'component', default: 'row' } } },
  });
  Object.assign(d.data.instances.main, { values: { items: [{ card: 'row' }, { card: 'box' }] } });
  const result = load(d);
  expect(result.diagnostics.filter((v) => v.severity === 'error')).toEqual([]);
  const p = new Player(result.model!);
  p.data.bind('main');
  const list = p.data.list('items'),
    item = list.at(0);
  list.swap(0, 1);
  p.step(0);
  // As with number/string, reacquire a scalar accessor after a move; ItemHandle retains identity.
  expect(item.component('card').value).toBe('row');
  item.component('card').set('box');
  p.step(0);
  expect(list.value).toEqual([{ card: 'box' }, { card: 'box' }]);
  list.remove(item);
  p.step(0);
  expect(() => item.component('card')).toThrow(/removed/);
});
