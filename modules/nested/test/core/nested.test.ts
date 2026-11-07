import '../../../../packages/core/src/all.ts';
import { describe, it, expect } from 'vitest';
import { load, Player, drawFrame, toSVG } from '../../../../packages/core/src/index.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
const source = (
  attrs = '',
  extra = '',
  requires = '',
) => `<anima version="0.1" name="nested-test" grid="20" requires="components nested bind data ${requires}">
<model name="Clock"><number name="t" default="0.5"/><component name="card" default="row"/></model>
<component name="row" grid="10" viewBox="-5 -5 10 10"><number name="count" default="2"/><circle id="dot" cx="0" cy="0" r="1" fill="#000"/><output name="done" value="count > 1"/>
<timeline name="go" duration="1"><track target="dot.r">0 1; 1 5</track><event at="0.5" name="middle"/></timeline><layer name="main" initial="go"><state name="go" play="go"/></layer><listener on="click" set="count=0"/></component>
<component name="box" grid="10"><rect id="rect" x0="0" y0="0" width="3" height="4" fill="#f00"/></component>
<instance id="badge" component="row" ${attrs}/>${extra}</anima>`;
function player(xml: string) {
  const r = compile(xml);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const loaded = load(r.doc!);
  expect(loaded.model).toBeDefined();
  return new Player(loaded.model!);
}
describe('nested instance extras', () => {
  it('remaps and scrubs child source time without rebuilding state; events cross both ways', () => {
    const p = player(source('time="$t"'));
    let r = p.step(0);
    expect(p.value('badge/dot.r')).toBe(3);
    expect(r.events.map((e) => e.name)).toContain('badge.middle');
    p.set('$t', 0.25);
    r = p.step(0);
    expect(p.value('badge/dot.r')).toBe(2);
    expect(r.events).toEqual([]);
    p.set('$t', 0.75);
    r = p.step(0);
    expect(p.value('badge/dot.r')).toBe(4);
    expect(r.events.map((e) => e.name)).toContain('badge.middle');
    p.set('$t', 0.25);
    r = p.step(0);
    expect(p.value('badge/dot.r')).toBe(2);
    expect(r.events.map((e) => e.name)).toContain('badge.middle');
  });
  it('quantizes source time, recognizes exact ticks, and keeps fractional elapsed accumulation', () => {
    const p = player(source('fps="12"'));
    p.step(0.12);
    expect(p.value('badge/dot.r')).toBeCloseTo(1 + 4 / 12, 12);
    p.step(1 / 6 - 0.12);
    expect(p.value('badge/dot.r')).toBeCloseTo(1 + 4 / 6, 12);
  });
  it('fits nonzero viewBoxes and inversely routes pointer coordinates', () => {
    const p = player(source('fit="contain" align="right" size="20 10"'));
    p.step(0);
    const frame = drawFrame(p),
      group = frame.tree.nodes[0]!.children[0]!;
    expect(frame.nodes[group]!.transform).toEqual([1, 0, 0, 1, 15, 5]);
    expect(toSVG(p)).toContain('matrix(1 0 0 1 15 5)');
    expect(p.get('badge.outputs.done')).toBe(true);
    p.pointer('down', 15, 5);
    p.pointer('up', 15, 5);
    p.step(0);
    expect(p.get('badge.outputs.done')).toBe(false);
  });
  it('exposes read-only outputs in values, guards, and next parent binding pass', () => {
    const p = player(
      source(
        '',
        '<circle id="result" cx="19" cy="19" r="1" fill="#000"/><bind target="result.opacity" value="badge.outputs.done"/>',
      ),
    );
    p.step(0);
    p.step(0);
    expect(p.value('result.opacity')).toBe(1);
    expect(p.value('badge/outputs.done')).toBe(true);
    expect(() => p.set('badge.outputs.done', false)).toThrow(/read-only-path/);
    p.set('badge.count', 0);
    expect(p.step(0).settled).toBe(false);
    expect(p.get('badge.outputs.done')).toBe(false);
    p.step(0);
    expect(p.value('result.opacity')).toBe(0);
  });
  it.each(['', 'lists'])(
    'rebuilds a component-valued placement only on selection changes (%s)',
    (module) => {
      const p = player(
        source()
          .replace('component="row" />', 'component="$card" />')
          .replace(
            'requires="components nested bind data ',
            `requires="components nested bind data ${module} `,
          ),
      );
      p.step(0);
      const first = (p.nested as unknown as { players: Map<string, Player> }).players.get('badge');
      expect(toSVG(p)).toContain('circle');
      p.set('$card', 'box');
      p.step(0);
      const second = (p.nested as unknown as { players: Map<string, Player> }).players.get('badge');
      expect(second).not.toBe(first);
      expect(toSVG(p)).toContain('<rect');
      p.step(0);
      expect((p.nested as unknown as { players: Map<string, Player> }).players.get('badge')).toBe(
        second,
      );
    },
  );
  it('round-trips component properties, time, fit and outputs through expanded markup', () => {
    const r = compile(source('time="$t" fps="12" fit="cover" size="8 4"'));
    expect(compile(decompile(r.doc!)).doc).toEqual(r.doc);
  });
  it.each([
    ['fit="contain"', 'instance-size', '/nodes/0/size'],
    ['time="$missing"', 'unknown-input', '/nodes/0/time'],
    ['component="$t"', 'component-path', '/nodes/0/component'],
  ])('diagnoses %s', (attrs, code, pointer) => {
    const xml = attrs.startsWith('component')
      ? source().replace('component="row" />', attrs + ' />')
      : source(attrs);
    const d = compile(xml).diagnostics.find((d) => d.code === code);
    expect(d).toMatchObject({ pointer });
    expect(d?.message).toBeTruthy();
    expect(d?.hint).toBeTruthy();
  });
  it.each(['set="badge.outputs.done=false"', 'toggle="badge.outputs.done"'])(
    'rejects output writes %s',
    (action) => {
      const d = compile(source('', `<listener on="click" ${action}/>`)).diagnostics.find(
        (d) => d.code === 'read-only-path',
      );
      expect(d?.pointer).toContain('/listeners/0/');
      expect(d?.hint).toBeTruthy();
    },
  );
  it('validates component property values and runtime clock values', () => {
    expect(
      compile(source().replace('default="row"', 'default="missing"')).diagnostics.some(
        (d) => d.code === 'unknown-component',
      ),
    ).toBe(true);
    const p = player(source('time="$t"'));
    p.set('$t', -1);
    expect(() => p.step(0)).toThrow(/nonnegative/);
  });
  it.each([
    ['missing + 1', 'output-expression'],
    ['outputs.done', 'output-expression'],
  ])('diagnoses output expression %s', (value, code) => {
    const r = compile(source().replace('value="count > 1"', `value="${value}"`));
    const d = r.diagnostics.find((d) => d.code === code);
    expect(d).toMatchObject({ pointer: '/components/row/outputs/done' });
    expect(d?.message).toBeTruthy();
    expect(d?.hint).toBeTruthy();
  });
  it('rejects host toggle writes and invalid component writes with a corrective error', () => {
    const p = player(source());
    expect(() => p.toggle('badge.outputs.done')).toThrow(/read-only-path/);
    expect(() => p.set('$card', 'missing')).toThrow();
  });
  it('hides and stops an empty selection and rebuilds when restored', () => {
    const p = player(source().replace('component="row" />', 'component="$card" />'));
    p.step(0);
    const first = (p.nested as unknown as { players: Map<string, Player> }).players.get('badge');
    p.set('$card', '');
    p.step(1);
    expect(toSVG(p)).not.toContain('<circle');
    p.set('$card', 'row');
    p.step(0);
    expect((p.nested as unknown as { players: Map<string, Player> }).players.get('badge')).not.toBe(
      first,
    );
    expect(p.value('badge/dot.r')).toBe(1);
  });
  it('supports child outputs when the child also owns a nested player', () => {
    const p = player(
      source().replace(
        '<component name="row" grid="10" viewBox="-5 -5 10 10">',
        '<component name="row" grid="10" viewBox="-5 -5 10 10"><instance id="inner" component="box"/>',
      ),
    );
    p.step(0);
    expect(p.get('badge.outputs.done')).toBe(true);
    p.set('badge.count', 0);
    expect(p.step(0).settled).toBe(false);
    expect(p.get('badge.outputs.done')).toBe(false);
  });
  it('composes remapping with motion timeline speed and completes at the state speed', () => {
    const p = player(
      source('time="$t"', '', 'motion').replace(
        '<timeline name="go" duration="1">',
        '<timeline name="go" duration="1" speed="2">',
      ),
    );
    p.step(0);
    expect(p.value('badge/dot.r')).toBe(5);
    const q = player(
      source('time="$t"').replace(
        '<state name="go" play="go"/>',
        '<state name="go" play="go" speed="2"/>',
      ),
    );
    expect(q.step(0)).toMatchObject({ settled: false, events: [{ name: 'badge.middle' }] });
    expect(q.step(0).settled).toBe(true);
    expect(q.value('badge/dot.r')).toBe(5);
  });
  it('diagnoses mismatched dynamic input interfaces', () => {
    const xml = source()
      .replace('component="row" />', 'component="$card" />')
      .replace(
        '<component name="box" grid="10">',
        '<component name="box" grid="10"><bool name="count"/>',
      );
    const d = compile(xml).diagnostics.find((d) => d.code === 'component-input-type');
    expect(d).toMatchObject({ pointer: '/nodes/0/component' });
    expect(d?.message).toBeTruthy();
    expect(d?.hint).toBeTruthy();
  });
  it('reports a structured live time diagnostic', () => {
    const p = player(source('time="$t"'));
    p.set('$t', -1);
    try {
      p.step(0);
      expect.unreachable('negative clock accepted');
    } catch (e) {
      expect(e).toMatchObject({
        code: 'instance-time',
        pointer: '/nodes/0/time',
        hint: expect.any(String),
      });
    }
  });
  it('resolves addresses from every dynamic choice and preserves wider selected input ranges', () => {
    let xml = source('', '<bind target="badge.gained" value="8"/>').replace(
      'component="row" />',
      'component="$card" />',
    );
    xml = xml
      .replace(
        '<number name="count" default="2"/>',
        '<number name="count" default="2" min="0" max="3"/>',
      )
      .replace(
        '<component name="box" grid="10">',
        '<component name="box" grid="10"><number name="count" min="0" max="8"/><number name="gained" default="2" max="10"/>',
      );
    const p = player(xml);
    p.step(0);
    p.set('$card', 'box');
    p.step(0);
    p.set('badge.count', 7);
    p.step(0);
    expect(p.get('badge.count')).toBe(7);
    expect(p.get('badge.gained')).toBe(8);
  });
  it('exposes bubbled events from later component choices', () => {
    const xml = source('', '<bool name="seen"/><listener on="badge.selected" set="seen=true"/>')
      .replace('component="row" />', 'component="$card" />')
      .replace('</rect>', '</rect>')
      .replace('<rect id="rect"', '<listener on="click" emit="selected"/><rect id="rect"');
    const p = player(xml);
    p.set('$card', 'box');
    p.step(0);
    p.pointer('down', 1, 1);
    p.pointer('up', 1, 1);
    expect(p.step(0).events.map((e) => e.name)).toContain('badge.selected');
    expect(p.get('seen')).toBe(false);
    p.step(0);
    expect(p.get('seen')).toBe(true);
  });
  it('rejects event/input name collisions between component choices', () => {
    const xml = source()
      .replace('component="row" />', 'component="$card" />')
      .replace('<rect id="rect"', '<listener on="click" emit="count"/><rect id="rect"');
    const d = compile(xml).diagnostics.find((d) => d.code === 'component-event-collision');
    expect(d).toMatchObject({ pointer: '/nodes/0' });
    expect(d?.message).toBeTruthy();
    expect(d?.hint).toBeTruthy();
  });
  it('defaults size-only fitting to contain and honors alignment without an explicit fit', () => {
    const p = player(source('size="20 20" align="right"'));
    p.step(0);
    const f = drawFrame(p),
      g = f.tree.nodes[0]!.children[0]!;
    expect(f.nodes[g]!.transform).toEqual([2, 0, 0, 2, 10, 10]);
  });
  it('binds color outputs and settles equal color values without repeated wakeups', () => {
    const p = player(
      source(
        '',
        '<circle id="result" cx="19" cy="19" r="1" fill="#000"/><bind target="result.fill" value="badge.outputs.tone"/>',
      ).replace(
        '<output name="done" value="count > 1"/>',
        '<output name="done" value="count > 1"/><output name="tone" value="mix(#f00, #00f, 0.5)"/>',
      ),
    );
    p.step(1);
    p.step(0);
    expect(p.value('result.fill.color')).toBe('#800080');
    expect(p.get('badge.outputs.tone')).toEqual([128, 0, 128, 255]);
    expect(p.step(0).settled).toBe(true);
  });
  it('rejects opaque composite output sources with a precise diagnostic', () => {
    const xml = source()
      .replace(
        '</model>',
        '<list name="items" of="Item"/></model><model name="Item"><number name="n"/></model>',
      )
      .replace('value="count > 1"', 'value="$items"');
    const d = compile(xml).diagnostics.find((d) => d.code === 'output-expression');
    expect(d).toMatchObject({ pointer: '/components/row/outputs/done' });
    expect(d?.hint).toBeTruthy();
    expect(d?.message).toBeTruthy();
  });
  it('preserves a numeric string clock expression and rejects an empty clock expression', () => {
    const r = compile(source('time="&quot;0.5&quot;"'));
    expect((r.doc!.nodes as { time: unknown }[])[0]!.time).toBe('0.5');
    expect(compile(decompile(r.doc!)).doc).toEqual(r.doc);
    const d = compile(source('time=""')).diagnostics.find((d) => d.code === 'bind-syntax');
    expect(d).toMatchObject({ pointer: '/nodes/0/time' });
    expect(d?.hint).toBeTruthy();
  });
});
