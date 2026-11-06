import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { load } from '@anima-format/core';
const read = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../../../../spec/conformance/${name}/case.ani`, import.meta.url), 'utf8'),
  );
const cases: [string, string, string, (d: ReturnType<typeof read>) => void][] = [
  [
    'machine-state',
    'state-machine-entry-state',
    '/entry/kind',
    (d) => (d.machine.layers.l.states.entry.pose = { 'dot.x': 1 }),
  ],
  [
    'machine-state',
    'state-machine-state-reset',
    '/a/reset',
    (d) => (d.machine.layers.l.states.a.reset = false),
  ],
  [
    'machine-blend',
    'state-machine-blend-1d-input',
    '/a/mix',
    (d) => (d.machine.layers.l.states.a.mix.children[1].at = 0),
  ],
  [
    'machine-blend',
    'state-machine-blend-exit-clock',
    '/a/mix/exit',
    (d) => (d.machine.layers.l.states.a.mix.exit = 99),
  ],
  [
    'machine-clock',
    'state-machine-transition-duration-relative',
    '/a/on/0/blendRatio',
    (d) => (d.machine.layers.l.states.a.on[0].blend = 1),
  ],
  [
    'machine-clock',
    'state-machine-transition-duration-relative',
    '/a/on/0',
    (d) => {
      delete d.machine.layers.l.states.a.play;
      d.machine.layers.l.states.a.pose = {};
    },
  ],
  [
    'machine-guard',
    'state-machine-condition-artboard',
    '/a/on/0/guard/left',
    (d) => (d.machine.layers.l.states.a.on[0].guard.left = {}),
  ],
  [
    'machine-guard',
    'state-machine-condition-artboard',
    '/a/on/0/guard',
    (d) => (d.machine.layers.l.states.a.on[0].guard.right = true),
  ],
  [
    'unknown-input',
    'machine-change-increased',
    '/a/on/0/change/input',
    (d) => (d.machine.layers.l.states.a.on[0].change.input = 'missing'),
  ],
  [
    'input-type',
    'machine-change-increased',
    '/a/on/0/change/input',
    (d) => (d.inputs.count = { type: 'bool' }),
  ],
  [
    'unknown-timeline',
    'state-machine-blend-direct',
    '/a/mix/children/0/play',
    (d) => (d.machine.layers.l.states.a.mix.children[0].play = 'missing'),
  ],
  [
    'unknown-target',
    'state-machine-condition-focus',
    '/a/on/0/guard/left/focus',
    (d) => (d.machine.layers.l.states.a.on[0].guard.left.focus = 'missing'),
  ],
  [
    'bind-syntax',
    'state-machine-blend-1d-data',
    '/a/mix/axis/bind',
    (d) => (d.machine.layers.l.states.a.mix.axis.bind = 'level +'),
  ],
  [
    'bind-type',
    'state-machine-blend-1d-data',
    '/a/mix/axis/bind',
    (d) => (d.machine.layers.l.states.a.mix.axis.bind = '#fff'),
  ],
  [
    'undeclared-feature',
    'state-machine-blend-1d-data',
    '/a/mix/axis',
    (d) => (d.requires = ['machine']),
  ],
];
for (const [code, name, path, edit] of cases)
  it(`${code}: ${path}`, () => {
    const d = read(name);
    edit(d);
    const diagnostic = load(d).diagnostics.find((x) => x.code === code);
    expect(diagnostic).toMatchObject({
      severity: 'error',
      pointer: '/machine/layers/l/states' + path,
    });
    expect(diagnostic!.message.length).toBeGreaterThan(5);
    expect(diagnostic!.hint?.length).toBeGreaterThan(5);
  });
it('rejects implicit clock conflicts and unbounded random totals', () => {
  const mix = read('state-machine-blend-direct');
  mix.requires.push('motion');
  mix.machine.layers.l.states.a.hold = true;
  expect(load(mix).diagnostics).toContainEqual(
    expect.objectContaining({ code: 'machine-clock', pointer: '/machine/layers/l/states/a/mix' }),
  );
  const random = read('state-machine-state-random');
  random.machine.layers.l.states.a.on.forEach((t: { weight: number }) => (t.weight = 1e308));
  expect(load(random).diagnostics).toContainEqual(
    expect.objectContaining({ code: 'machine-state', pointer: '/machine/layers/l/states/a/on' }),
  );
  const timed = read('state-machine-transition-duration-relative');
  timed.requires.push('motion');
  timed.machine.layers.l.states.a.speed = 0;
  expect(load(timed).diagnostics).toContainEqual(
    expect.objectContaining({ code: 'machine-clock', pointer: '/machine/layers/l/states/a/on/0' }),
  );
});
