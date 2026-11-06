import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';
import { compile, decompile, formatMarkup } from '@anima-format/markup';
const root = new URL('../../../../', import.meta.url);
const source = readFileSync(
  new URL('spec/conformance/motion-sync-input-handoff/case.ani', root),
  'utf8',
);
const doc = () => JSON.parse(source);
const player = (d = doc()) => {
  const r = load(d);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(r.model!);
};
it('round trips controls and the sync example through both syntaxes', () => {
  const s = readFileSync(new URL('modules/motion/examples/sync.animl', root), 'utf8');
  const c = compile(s);
  expect(c.diagnostics).toEqual([]);
  expect(compile(decompile(c.doc!)).doc).toEqual(c.doc);
  expect(formatMarkup(s).text).toBe(s);
});
for (const [code, path, edit] of [
  [
    'motion-sync',
    '/spin/on/0/sync',
    (d: ReturnType<typeof doc>) => {
      d.machine.layers.l.states.idle = { pose: {} };
    },
  ],
  [
    'motion-control',
    '/idle',
    (d: ReturnType<typeof doc>) => {
      d.machine.layers.l.states.idle = { pose: {}, hold: true };
    },
  ],
  [
    'motion-control',
    '/idle/time',
    (d: ReturnType<typeof doc>) => {
      d.machine.layers.l.states.idle.hold = true;
    },
  ],
  [
    'undeclared-feature',
    '/idle/time',
    (d: ReturnType<typeof doc>) => {
      d.requires = ['motion'];
    },
  ],
  [
    'bind-type',
    '/idle/time',
    (d: ReturnType<typeof doc>) => {
      d.machine.layers.l.states.idle.time = '#fff';
    },
  ],
  [
    'bind-syntax',
    '/idle/time',
    (d: ReturnType<typeof doc>) => {
      d.machine.layers.l.states.idle.time = 'phase +';
    },
  ],
  [
    'unknown-input',
    '/idle/time',
    (d: ReturnType<typeof doc>) => {
      d.machine.layers.l.states.idle.time = 'missing';
    },
  ],
  [
    'motion-exit',
    '/spin/on/0/exitNext',
    (d: ReturnType<typeof doc>) => {
      d.machine.layers.l.states.spin.on[0].when = '@after(1)';
    },
  ],
  [
    'motion-exit',
    '/spin/on/0/exitNext',
    (d: ReturnType<typeof doc>) => {
      d.machine.layers.l.states.spin.on[0].exit = 0;
    },
  ],
  [
    'motion-exit',
    '/spin/on/0/exitNext',
    (d: ReturnType<typeof doc>) => {
      d.machine.layers.l.states.spin.hold = true;
    },
  ],
] as const)
  it(`diagnoses ${code} at ${path}`, () => {
    const d = doc();
    edit(d);
    const r = load(d);
    expect(r.model).toBeUndefined();
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        pointer: '/machine/layers/l/states' + path,
        severity: 'error',
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
  });
it('handles exact tick requests without waiting another step', () => {
  const p = player();
  p.set('syncing', true);
  p.step(0);
  p.step(0.25);
  p.set('syncing', false);
  expect(p.step(0).settled).toBe(true);
  expect(p.value('a.x')).toBe(2);
  expect(p.states().l).toBe('idle');
});
it('uses reduced-motion entry poses before clock expressions or boundary waits', () => {
  const d = doc();
  d.timelines.t.reducedMotion = 'skip';
  const p = player(d);
  p.reducedMotion = true;
  p.set('syncing', true);
  p.step(0);
  p.step(0.375);
  expect(p.value('a.x')).toBe(0);
  p.set('syncing', false);
  expect(p.step(0).settled).toBe(true);
  expect(p.states().l).toBe('idle');
  p.set('phase', 0.75);
  p.step(0);
  expect(p.value('a.x')).toBe(0);
});
it('keeps control state independent in named machine instances', () => {
  const d = doc();
  d.machines = { other: structuredClone(d.machine) };
  const p = player(d),
    m = p.machine('other');
  m.set('phase', 0.75);
  p.step(0);
  expect(m.player.value('a.x')).toBe(6);
  expect(p.inspect().find((l) => l.layer === 'l')!.time).toBe(0);
  expect(m.player.inspect()[0]!.time).toBe(0.75);
});
it('treats non-finite expression arithmetic as zero and clamps to a work area', () => {
  const d = doc();
  d.machine.layers.l.states.idle.time = 'phase / phase';
  d.timelines.t.work = [0.25, 0.75];
  const p = player(d);
  p.step(0);
  expect(p.value('a.x')).toBe(2);
  p.set('phase', 1);
  p.step(0); // 1/1 clamps to .75, loop folds to .25
  expect(p.value('a.x')).toBe(2);
});
