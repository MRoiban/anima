import '../../../../packages/core/src/all.ts';
import { it, expect } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
export const source = (
  when = '$card == component("row")',
) => `<anima version="0.1" name="component-guard" grid="20" requires="data components nested">
<model name="Card"><component name="card" default="row"/><string name="text" default="row"/></model>
<component name="row" grid="10"><circle id="dot" cx="5" cy="5" r="2"/></component>
<circle id="probe" cx="10" cy="10" r="1"/>
<layer name="main" initial="idle"><state name="idle"><pose probe.r="1"/><on when='${when}' to="match"/></state><state name="match"><pose probe.r="9"/></state></layer></anima>`;
it('typed component guard works without numeric bind; both spellings round-trip', () => {
  const r = compile(source());
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect(compile(decompile(r.doc!)).doc).toEqual(r.doc);
  const p = new Player(load(r.doc!).model!);
  p.step(0);
  expect(p.states()).toEqual({ main: 'match' });
  expect(p.value('probe.r')).toBe(9);
  const other = new Player(load(r.doc!).model!);
  other.set('$card', '');
  other.step(0);
  expect(other.value('probe.r')).toBe(1);
});
it.each(['$card == component("missing")', '$text == component("row")', '$card > component("row")'])(
  'diagnoses invalid typed function: %s',
  (when) => {
    const d = compile(source(when)).diagnostics.find((d) => d.code === 'guard-literal');
    expect(d).toMatchObject({ pointer: '/machine/layers/main/states/idle/on/0/when' });
    expect(d?.message).toBeTruthy();
    expect(d?.hint).toBeTruthy();
  },
);
it('inequality accepts the empty component property and is player-local', () => {
  const r = compile(source('$card != component("row")'));
  const m = load(r.doc!).model!;
  const a = new Player(m),
    b = new Player(m);
  a.set('$card', '');
  a.step(0);
  b.step(0);
  expect(a.value('probe.r')).toBe(9);
  expect(b.value('probe.r')).toBe(1);
});
it.each(['constructor', 'toString'])(
  'does not treat inherited object methods as registered literal functions: %s',
  (name) => {
    const r = compile(source('$card == ' + name + '("row")'));
    expect(r.doc).toBeUndefined();
    expect(r.diagnostics.some((d) => d.severity === 'error')).toBe(true);
  },
);
it('diagnoses malformed JSON string escapes instead of throwing from core load', () => {
  const r = compile(source());
  const doc = r.doc as {
    machine: { layers: { main: { states: { idle: { on: { when: string }[] } } } } };
  };
  doc.machine.layers.main.states.idle.on[0]!.when = String.raw`$card == component("\q")`;
  const d = load(doc).diagnostics.find((d) => d.code === 'guard-literal');
  expect(d).toMatchObject({ pointer: '/machine/layers/main/states/idle/on/0/when' });
  expect(d?.message).toBeTruthy();
  expect(d?.hint).toBeTruthy();
});
