import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { load, Player } from '@anima-format/core';
const doc = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../../../../spec/conformance/${name}/case.ani`, import.meta.url), 'utf8'),
  );
const create = (d: object) => {
  const r = load(d);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(r.model!);
};
it('two players share neither random choices nor mutable relative durations', () => {
  const r = load(doc('state-machine-state-random'));
  const a = new Player(r.model!),
    b = new Player(r.model!);
  a.step(0);
  b.step(0);
  expect(a.states()).toEqual(b.states());
  const d = doc('state-machine-transition-duration-relative');
  d.requires.push('motion');
  const model = load(d).model!,
    x = new Player(model),
    y = new Player(model);
  x.step(0.5);
  x.fire('go');
  x.step(0);
  x.step(0.25);
  expect(x.value('dot.x')).toBe(6.25);
  expect(y.value('dot.x')).toBe(0);
  y.step(0.5);
  y.fire('go');
  y.step(0);
  y.step(0.25);
  expect(y.value('dot.x')).toBe(6.25);
  expect(model.layers[0]!.states[0]!.on[0]!.blend).toBe(0);
});
it('change guards compare final queued values and fire once through any-state self re-entry', () => {
  const d = doc('state-machine-any-state');
  d.inputs = { count: { type: 'number' } };
  d.machine.layers.l.states = {
    all: {
      pose: {},
      kind: 'any',
      on: [{ when: '@after(0)', to: 'pop', change: { input: 'count', mode: 'increased' } }],
    },
    idle: { pose: { 'dot.x': 0 } },
    pop: { pose: { 'dot.x': 10 }, emit: 'pop' },
  };
  d.machine.layers.l.initial = 'idle';
  const p = create(d);
  p.set('count', 1);
  expect(p.step(0).events.map((e) => e.name)).toEqual(['pop']);
  p.set('count', 99);
  expect(p.step(0).events.map((e) => e.name)).toEqual(['pop']);
  expect(p.step(0).events).toEqual([]);
});
it('every layer sees the same previous-value signal', () => {
  const d = doc('machine-change-increased');
  d.machine.layers.other = structuredClone(d.machine.layers.l);
  const p = create(d);
  p.set('count', 100);
  p.step(0);
  expect(p.states()).toEqual({ l: 'b', other: 'b' });
});
it('focus equality and inequality read the supplied live hook', () => {
  const d = doc('state-machine-condition-focus');
  d.machine.layers.l.states.a.on[0].guard.right = true;
  const p = create(d);
  let owner = false;
  p.machineFocus = () => owner;
  p.step(0);
  expect(p.states()).toEqual({ l: 'a' });
  owner = true;
  p.step(0);
  expect(p.states()).toEqual({ l: 'b' });
});
it('initial entry actions apply on the first step, without a constructor-time input mutation', () => {
  const d = doc('state-machine-state-entry-actions');
  d.machine.layers.l.states.a.enterActions = { set: { flag: true } };
  const p = create(d);
  expect(p.get('flag')).toBe(false);
  p.step(0);
  expect(p.get('flag')).toBe(true);
});
it('end actions wait for completion and are cancelled by interruption', () => {
  const d = doc('state-machine-transition-end-actions');
  d.machine.layers.l.states.a.on[0].blend = 1;
  const p = create(d);
  p.fire('go');
  p.step(0);
  p.step(0.5);
  expect(p.get('flag')).toBe(false);
  p.step(0.5);
  expect(p.get('flag')).toBe(false);
  p.step(0);
  expect(p.get('flag')).toBe(true);
  expect(p.step(0).events).toEqual([]);
  d.inputs.stop = { type: 'trigger' };
  d.machine.layers.l.states.b.on = [{ when: 'stop', to: 'c' }];
  d.machine.layers.l.states.c = { pose: {} };
  const q = create(d);
  q.fire('go');
  q.step(0);
  q.fire('stop');
  q.step(0.5);
  q.step(1);
  q.step(0);
  expect(q.get('flag')).toBe(false);
});
it('a zero-weight or disabled random edge cannot win and consumes no trigger', () => {
  const d = doc('state-machine-state-random');
  d.machine.layers.l.states.a.on[0].weight = 0;
  d.machine.layers.l.states.a.on[1].disabled = true;
  const p = create(d);
  expect(p.step(0).events).toEqual([]);
  expect(p.states()).toEqual({ l: 'a' });
});
it('a looped non-exit child keeps a blend awake', () => {
  const d = doc('state-machine-blend-direct');
  d.timelines.t1.loop = 'loop';
  const p = create(d);
  expect(p.step(5).settled).toBe(false);
});
it('machine and motion preserve source clock/ease/seek behavior outside blend states', () => {
  const d = doc('state-machine-exit-time-relative');
  d.requires.push('motion');
  d.timelines.t.work = [0.5, 1.5];
  d.timelines.t.speed = 2;
  const p = create(d);
  p.step(0.2);
  expect(p.states()).toEqual({ l: 'a' });
  p.step(0.05);
  expect(p.states()).toEqual({ l: 'b' });
});
