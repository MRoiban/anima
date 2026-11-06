import '@anima-format/core/all';
import { it, expect } from 'vitest';
import { load } from '../../../../packages/core/src/index.ts';
const base = (properties: object, extra: object = {}) => ({
  anima: '0.1',
  name: 'invalid',
  grid: 20,
  requires: ['data', 'bind'],
  data: { models: { Root: { properties } } },
  nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
  ...extra,
});
it.each([
  ['data-type', '/data/models/Root/properties/n', base({ n: { type: 'number', default: 'bad' } })],
  ['data-enum', '/data/models/Root/properties/n', base({ n: { type: 'enum', system: 'missing' } })],
  [
    'data-model',
    '/data/models/Root/properties/n',
    base({ n: { type: 'model-ref', model: 'Missing' } }),
  ],
  [
    'data-property',
    '/data/models/Root/properties/n',
    base({ n: { type: 'number', min: 2, max: 1 } }),
  ],
  ['data-cycle', '/data/models/Root/properties', base({ n: { type: 'model-ref', model: 'Root' } })],
  [
    'data-instance',
    '/data/preview',
    base(
      { n: { type: 'number' } },
      { data: { models: { Root: { properties: { n: { type: 'number' } } } }, preview: 'missing' } },
    ),
  ],
  ['data-path', '/bind/dot.x', base({ n: { type: 'number' } }, { bind: { 'dot.x': '$missing' } })],
  [
    'data-readonly',
    '/bind/dot.x',
    base(
      { items: { type: 'list' } },
      { bind: { 'dot.x': { value: '$items.length', mode: 'to-source' } } },
    ),
  ],
  ['data-type', '/bind/dot.x', base({ n: { type: 'string' } }, { bind: { 'dot.x': '$n' } })],
  [
    'data-binding',
    '/bind/dot.x/prefer',
    base({ n: { type: 'number' } }, { bind: { 'dot.x': { value: '$n', prefer: 'target' } } }),
  ],
  [
    'data-converter',
    '/bind/dot.x/convert',
    base({ n: { type: 'number' } }, { bind: { 'dot.x': { value: '$n', convert: 'missing' } } }),
  ],
  [
    'data-copy',
    '/listeners/0/copy',
    base({ n: { type: 'number' } }, { listeners: [{ on: 'click', copy: 'bad' }] }),
  ],
  [
    'data-asset',
    '/data/models/Root/properties/n',
    base({ n: { type: 'asset-ref', assetType: 'image', default: 'missing' } }),
  ],
] as const)('%s includes a pointer, message and corrective hint', (code, pointer, raw) => {
  const r = load(raw);
  expect(r.model).toBeUndefined();
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({
      code,
      pointer: expect.stringContaining(pointer),
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});
it('keeps absent data declarations strict and rejects binding objects without data', () => {
  expect(
    load({
      anima: '0.1',
      name: 'bad',
      grid: 20,
      requires: ['bind'],
      nodes: [],
      bind: { 'dot.x': { value: '1' } },
    }).diagnostics,
  ).toContainEqual(expect.objectContaining({ code: 'undeclared-feature', pointer: '/bind/dot.x' }));
});
it('never silently ignores a dollar expression when data is undeclared', () => {
  const r = load({
    anima: '0.1',
    name: 'bad',
    grid: 20,
    requires: ['bind'],
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
    bind: { 'dot.x': '$missing' },
  });
  expect(r.model).toBeUndefined();
  expect(r.diagnostics.some((d) => d.code === 'unknown-input')).toBe(true);
});
it('does not coerce explicit null values to scalar defaults', () => {
  const r = load(base({ n: { type: 'number', default: null } }));
  expect(r.model).toBeUndefined();
  expect(r.diagnostics).toContainEqual(expect.objectContaining({ code: 'data-type' }));
});
it('does not resolve inherited JavaScript members as models or custom properties', () => {
  expect(load(base({ n: { type: 'model-ref', model: 'constructor' } })).model).toBeUndefined();
  const r = load(
    base(
      { n: { type: 'string' } },
      {
        nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1, properties: {} }],
        bind: { 'dot.properties.toString': '$n' },
      },
    ),
  );
  expect(r.model).toBeUndefined();
  expect(r.diagnostics).toContainEqual(expect.objectContaining({ code: 'unknown-address' }));
});
