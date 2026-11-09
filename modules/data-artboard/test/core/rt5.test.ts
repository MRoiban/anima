import '../../../../packages/core/src/all.ts';
import { expect, it } from 'vitest';
import { load } from '../../../../packages/core/src/index.ts';
const requires = ['data', 'components', 'nested', 'host', 'dataartboard'];
it('R5-1: a frozen document with an artboard property loads without being written', () => {
  const doc = Object.freeze({
    anima: '0.1',
    name: 'frozen',
    grid: 20,
    requires,
    data: Object.freeze({
      models: { Root: { properties: { content: { type: 'artboard', default: '' } } } },
    }),
    nodes: [{ id: 'empty', type: 'group', children: [] }],
  });
  const r = load(doc);
  expect(r.diagnostics).toEqual([]);
  expect(r.model).toBeDefined();
  expect(doc.data.models.Root.properties.content.type).toBe('artboard');
});
it('R5-3: $comment entries in models and properties are not normalized as definitions', () => {
  for (const where of ['models', 'properties']) {
    const models: Record<string, unknown> = {
      Root: { properties: { n: { type: 'number', default: 1 } } as Record<string, unknown> },
    };
    if (where === 'models') models.$comment = null;
    else (models.Root as { properties: Record<string, unknown> }).properties.$comment = null;
    const r = load({
      anima: '0.1',
      name: 'comments',
      grid: 20,
      requires,
      data: { models },
      nodes: [{ id: 'empty', type: 'group', children: [] }],
    });
    expect(r.diagnostics).toEqual([]);
  }
});
