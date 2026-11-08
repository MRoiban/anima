import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player, jsonSchema, runScript } from '../../../../packages/core/src/index.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
export const rolesDoc = {
  anima: '0.1',
  name: 'bf4-roles',
  grid: 40,
  requires: ['a11y'],
  inputs: { amount: { type: 'number', default: 40 } },
  nodes: [
    {
      id: 'progress',
      type: 'group',
      a11y: { role: 'progressbar', label: 'Loading', value: 'amount', min: 0, max: 80 },
    },
    { id: 'pending', type: 'group', a11y: { role: 'progressbar', label: 'Waiting' } },
    {
      id: 'meter',
      type: 'group',
      a11y: { role: 'meter', label: 'Capacity', value: 'amount', min: 0, max: 80 },
    },
    { id: 'status', type: 'group', a11y: { role: 'status', label: 'Ready' } },
    {
      id: 'opener',
      type: 'group',
      a11y: { role: 'button', label: 'Details', expanded: true, controls: 'panel' },
    },
    { id: 'panel', type: 'group', a11y: { role: 'dialog', label: 'Details', modal: false } },
  ],
};
it('B17: progress, indeterminate progress, meter, status, controls and existing dialog metadata survive both spellings and headless commands', () => {
  for (const doc of [rolesDoc, compile(decompile(rolesDoc)).doc!]) {
    const r = load(doc);
    expect(r.diagnostics).toEqual([]);
    const p = new Player(r.model!);
    p.step(0);
    expect(p.semantics()).toMatchObject([
      { id: 'progress', role: 'progressbar', value: 40, min: 0, max: 80, actions: [] },
      { id: 'pending', role: 'progressbar', min: 0, max: 100 },
      { id: 'meter', role: 'meter', value: 40, min: 0, max: 80, actions: [] },
      { id: 'status', role: 'status', states: { live: 'polite' } },
      { id: 'opener', controls: 'panel', states: { expanded: true } },
      { id: 'panel', states: { modal: false } },
    ]);
    expect(p.semantics()[1]).not.toHaveProperty('value');
    expect(runScript(r.model!, 'semantics').output[0]).toEqual(p.semantics());
  }
  expect(JSON.stringify(jsonSchema())).toContain('progressbar');
});
it.each([
  [{ role: 'meter' }, 'value', 'bad-value'],
  [{ role: 'progressbar', value: 'missing' }, 'value', 'unknown-input'],
  [{ role: 'progressbar', value: 'on' }, 'value', 'input-type'],
  [{ role: 'button', controls: 'missing' }, 'controls', 'bad-value'],
  [{ role: 'button', controls: 'bad' }, 'controls', 'bad-value'],
])('B17: diagnoses invalid role metadata %j with a field pointer and hint', (a11y, key, code) => {
  const r = load({
    ...rolesDoc,
    inputs: { on: { type: 'bool' } },
    nodes: [{ id: 'bad', type: 'group', a11y }],
  });
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({
      code,
      pointer: '/nodes/0/a11y/' + key,
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});

it('B17: controls relations follow component placement ids without leaking across instances', () => {
  const r = load({
    ...rolesDoc,
    requires: ['a11y', 'components'],
    inputs: {},
    nodes: [
      { id: 'a', type: 'instance', component: 'panelSet' },
      { id: 'b', type: 'instance', component: 'panelSet' },
    ],
    components: { panelSet: { grid: 40, inputs: rolesDoc.inputs, nodes: rolesDoc.nodes } },
  });
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  p.step(0);
  expect(
    p
      .semantics()
      .filter((n) => n.id.endsWith('.opener'))
      .map((n) => [n.id, n.controls]),
  ).toEqual([
    ['a.opener', 'a.panel'],
    ['b.opener', 'b.panel'],
  ]);
});
