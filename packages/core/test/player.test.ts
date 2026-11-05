import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { load, Player, runScript } from '../src/index.ts';

const bell = load(
  readFileSync(new URL('../../../examples/bell.ani', import.meta.url), 'utf8'),
).model!;

describe('player host interface', () => {
  it('includes named inputs in selected script snapshots and preserves unlisted snapshots', () => {
    const before = runScript(bell, 'snapshot').snapshots[0]!;
    const selected = runScript(bell, 'snapshot hover swing.rotate').snapshots[0]!;
    expect(selected.values).toEqual({ hover: false, 'swing.rotate': 0 });
    expect(before.values).not.toHaveProperty('hover');
  });
  it('samples applied bool and number inputs, rejecting unknown names and triggers', () => {
    const doc = JSON.parse(
      readFileSync(new URL('../../../examples/bell.ani', import.meta.url), 'utf8'),
    );
    doc.inputs.level = { type: 'number', default: 2 };
    const model = load(JSON.stringify(doc)).model!;
    const snapshots = runScript(
      model,
      'set level 4\nset hover true\nsnapshot level hover\nadvance 0\nsnapshot level hover swing.rotate\nsnapshot',
    ).snapshots;
    expect(snapshots[0]!.values).toEqual({ level: 2, hover: false });
    expect(snapshots[1]!.values).toEqual({ level: 4, hover: true, 'swing.rotate': 0 });
    expect(snapshots[2]!.values).not.toHaveProperty('level');
    expect(snapshots[2]!.values).not.toHaveProperty('hover');
    for (const name of ['missing', 'ring'])
      expect(() => runScript(model, `snapshot ${name}`)).toThrow(
        /line 1:.*not an animated address or a bool\/number input/,
      );
  });
  it('rejects unknown inputs and wrong types instead of ignoring them', () => {
    const p = new Player(bell);
    expect(() => p.set('hovr', true)).toThrow(/no input "hovr"/);
    expect(() => p.set('hover', 1)).toThrow(/takes a bool/);
    expect(() => p.fire('hover')).toThrow(/is bool/);
    expect(() => p.set('ring', true)).toThrow(/is trigger/);
    expect(() => p.step(-1)).toThrow();
  });

  it('settles after a ring and reports changed slots', () => {
    const p = new Player(bell);
    expect(p.step(0).settled).toBe(true);
    p.fire('ring');
    const r = p.step(0);
    expect(r.events).toEqual([{ name: 'rang', layer: 'ring', time: 0 }]);
    expect(r.settled).toBe(false);
    p.takeDirty();
    p.step(0.1);
    const dirty = p.takeDirty().map((s) => p.addrs[s]);
    expect(dirty).toContain('swing.rotate');
    expect(dirty).not.toContain('icon.scale');
    let settled = false;
    for (let i = 0; i < 100 && !settled; i++) settled = p.step(1 / 60).settled;
    expect(settled).toBe(true);
    expect(p.states()).toEqual({ ring: 'rested', hover: 'rest' });
    expect(p.takeDirty().length).toBeGreaterThan(0);
    p.step(1 / 60);
    expect(p.takeDirty()).toEqual([]);
  });

  it('firing a pending trigger twice is one fire', () => {
    const p = new Player(bell);
    p.fire('ring');
    p.fire('ring');
    expect(p.step(0).events.length).toBe(1);
  });

  it('hit-tests node targets on glyph geometry, following transforms', () => {
    const m = load({
      ...JSON.parse(readFileSync(new URL('../../../examples/bell.ani', import.meta.url), 'utf8')),
      listeners: [{ on: 'click', target: 'clapper', fire: 'ring' }],
    }).model!;
    const p = new Player(m);
    const l = m.listeners[0]!;
    expect(p.hits(l, 10, 16.9)).toBe(true); // on the clapper's ink
    expect(p.hits(l, 10, 10)).toBe(false); // inside the bell's hollow
    expect(p.hits({ ...l, target: m.ids.get('body')! }, 10, 10)).toBe(false); // evenodd hole
    expect(p.hits({ ...l, target: m.ids.get('body')! }, 10, 14.1)).toBe(true); // the rim
    expect(p.hits({ ...l, target: m.ids.get('swing')! }, 10, 16.9)).toBe(true); // group → descendants
    expect(p.hits({ ...l, target: -1 }, 0.5, 0.5)).toBe(false); // outside the hit disc
    expect(p.hits({ ...l, target: -1 }, 10, 0)).toBe(true);
  });
});
