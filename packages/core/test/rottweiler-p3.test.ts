import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '../src/index.ts';
import { createScriptSession } from '../src/script.ts';

// Rottweiler P3 R1-04: an unrelated, explicitly seeded root stepped re-entrantly (from another
// seeded player's data subscription) keeps its own random source.
it('keeps an explicitly seeded root on its own random source when stepped re-entrantly', () => {
  const { model, diagnostics } = load({
    anima: '0.1',
    name: 'rng',
    grid: 20,
    requires: ['data', 'bind', 'convert'],
    data: { models: { State: { properties: { value: { type: 'number' } } } } },
    converters: { rng: { type: 'formula', expression: 'random()', random: 'always' } },
    bind: { 'dot.x': { value: '$value', convert: 'rng' } },
    nodes: [{ id: 'dot', type: 'circle', center: [2, 2], r: 1, fill: { color: '#000' } }],
  });
  expect(diagnostics).toEqual([]);
  const a = new Player(model!, { seed: 1 });
  const b = new Player(model!, { seed: 1000 });
  const control = new Player(model!, { seed: 1000 });
  a.data.bind(a.data.defaultInstance());
  a.data.number('$value').on('change', () => b.step(0));
  a.data.number('$value').set(1);
  a.step(0);
  control.step(0);
  expect(b.value('dot.x')).toBe(control.value('dot.x'));
  b.step(0);
  control.step(0);
  expect(b.value('dot.x')).toBe(control.value('dot.x'));
});

// Rottweiler P3 R2-02: a root seeded by the script `seed` command is a root too.
it('keeps a script-seeded root on its own random source when stepped re-entrantly', () => {
  const doc = {
    anima: '0.1',
    name: 'random',
    grid: 20,
    requires: ['data', 'bind', 'convert'],
    data: { models: { M: { properties: { count: { type: 'number', default: 0 } } } } },
    converters: { rng: { type: 'formula', expression: 'random()' } },
    bind: { 'dot.x': { value: '$count', convert: 'rng' } },
    nodes: [{ id: 'dot', type: 'circle', center: [0, 0], r: 1, fill: { color: '#000' } }],
  };
  const session = () => createScriptSession(load(doc).model!);
  const a = session(),
    b = session(),
    control = session();
  a.execute('seed 3');
  b.execute('seed 7');
  control.execute('seed 7');
  a.player.data.number('$default:count').on('change', () => b.player.step(0));
  a.execute('data set $count 1');
  a.player.step(0);
  control.player.step(0);
  expect(b.player.value('dot.x')).toBe(control.player.value('dot.x'));
});

// Rottweiler P3 R2-03: semantic commands are journaled, so data breakpoints see their writes.
it('stops a semantic action at a data breakpoint and resumes it after clearing', () => {
  const { model } = load({
    anima: '0.1',
    name: 'break-semantic',
    grid: 20,
    requires: ['data', 'a11y', 'focus'],
    data: { models: { M: { properties: { enabled: { type: 'bool', default: false } } } } },
    nodes: [
      {
        id: 'button',
        type: 'circle',
        center: [5, 5],
        r: 2,
        fill: { color: '#000' },
        a11y: { role: 'switch', label: 'Toggle', checked: '$enabled' },
      },
    ],
  });
  const engine = createScriptSession(model!);
  engine.execute('advance 0');
  const stopped = engine.execute('data break $enabled\nsemantic button tap\nsnapshot $enabled');
  expect(stopped.stopped).toBe(true);
  expect(stopped.snapshots).toEqual([]);
  expect(stopped.diagnostics).toMatchObject([
    { code: 'script-breakpoint', message: expect.stringContaining('would write true') },
  ]);
  expect(stopped.diagnostics[0]!.writer![0]).toContain('semantic button tap');
  expect(engine.player.get('$enabled')).toBe(false);
  const resumed = engine.execute('data break clear\nadvance 0\nsnapshot $enabled');
  expect(resumed.stopped).toBe(false);
  expect(engine.player.get('$enabled')).toBe(true);
  // A later breakpoint replays the accepted tap once: no stale or doubled write is trapped.
  const later = engine.execute('data break $enabled\nadvance 0.1');
  expect(later.diagnostics).toEqual([]);
  expect(later.stopped).toBe(false);
});

// Rottweiler P3 R3-04: a semantic command that fails after mutating keeps its mutations journaled.
it('replays a semantic command that failed after mutating the player', () => {
  const { model, diagnostics } = load({
    anima: '0.1',
    name: 'throwing',
    grid: 20,
    requires: ['data', 'a11y', 'focus', 'components', 'nested', 'bind'],
    data: {
      models: {
        M: {
          properties: {
            enabled: { type: 'bool', default: false },
            bad: { type: 'bool', default: true },
          },
        },
      },
    },
    components: {
      row: {
        grid: 20,
        nodes: [{ id: 'dot', type: 'circle', center: [1, 1], r: 1, fill: { color: '#000' } }],
      },
    },
    nodes: [
      {
        id: 'button',
        type: 'circle',
        center: [5, 5],
        r: 1,
        fill: { color: '#000' },
        a11y: { role: 'switch', label: 'B', checked: '$enabled' },
      },
      { id: 'child', type: 'instance', component: 'row', time: '-($enabled and $bad)' },
    ],
  });
  expect(diagnostics).toEqual([]);
  const s = createScriptSession(model!);
  s.execute('advance 0');
  expect(s.execute('expect-error instance-time\nsemantic button tap').diagnostics).toEqual([]);
  expect(s.player.get('$enabled')).toBe(true);
  s.execute('data set $bad false');
  const stopped = s.execute('data break $enabled == false\nsemantic button tap');
  expect(stopped.stopped).toBe(true);
  expect(stopped.diagnostics).toMatchObject([{ code: 'script-breakpoint' }]);
  expect(s.player.get('$enabled')).toBe(true);
});
