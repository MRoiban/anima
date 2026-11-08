// Regression tests for P4 Rottweiler review findings (design/rottweiler/P4-LEDGER.md).
import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';

it('R1-08: string event payload literals that spell $paths stay literal', () => {
  const r = load({
    anima: '0.1',
    name: 'p4',
    grid: 20,
    requires: ['data', 'events'],
    nodes: [{ id: 'c', type: 'circle', center: [10, 10], r: 4, fill: { color: '#000' } }],
    listeners: [{ on: 'click', emit: 'hello' }],
    eventDefs: { hello: { payload: { text: { type: 'string', value: '$literal' } } } },
    data: { models: { M: { properties: { x: { type: 'number', default: 0 } } } } },
  });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  p.pointer('down', 10, 10);
  p.pointer('up', 10, 10);
  const events = p.step(0).events;
  expect(events.find((e) => e.name === 'hello')?.payload).toEqual({ text: '$literal' });
});

it('R2-02: custom property defaults and embedded run text are literals, not data paths', () => {
  const errors = (node: object, requires: string[] = []) =>
    load({
      anima: '0.1',
      name: 'p4',
      grid: 20,
      requires: ['data', ...requires],
      nodes: [node],
      data: { models: { M: { properties: { x: { type: 'number', default: 0 } } } } },
    }).diagnostics.filter((d) => d.severity === 'error');
  expect(errors({ id: 'g', type: 'group', children: [], properties: { label: '$price' } })).toEqual(
    [],
  );
  expect(
    errors({
      id: 'g',
      type: 'group',
      children: [],
      properties: { label: { type: 'string', default: '$price' } },
    }),
  ).toEqual([]);
  const text = (t: string) => ({
    id: 't',
    type: 'text',
    sizing: 'auto-width',
    styles: { s: { size: 2 } },
    runs: [{ text: t, style: 's' }],
  });
  expect(errors(text('Price $total'), ['text'])).toEqual([]);
  expect(errors(text('$missing'), ['text']).length).toBeGreaterThan(0);
});
