import '../../../../packages/core/src/all.ts';
import { it, expect } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
const source = (
  value = '$peak',
  ease = '',
) => `<anima version="0.1" name="data-keys" grid="20" requires="data motion">
<model name="Levels"><number name="peak" default="8"/><bool name="ready"/><color name="tint" default="#00f"/><string name="label" default="new"/></model>
<circle id="probe" cx="10" cy="10" r="1" fill="#f00"><channel name="label" type="string" value='"old"'/></circle>
<timeline name="rise" duration="1"><track target="probe.r"><key t="0" value="0" ${ease}/><key t="1" value="${value}"/></track></timeline>
<layer name="main" initial="run"><state name="run" play="rise"/></layer></anima>`;
function model(xml = source()) {
  const r = compile(xml);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect(compile(decompile(r.doc!)).doc).toEqual(r.doc);
  return load(r.doc!).model!;
}
it('samples current data endpoints per player, without mutating shared tracks', () => {
  const m = model(),
    before = [...m.timelines[0]!.tracks[0]!.values];
  const a = new Player(m),
    b = new Player(m);
  a.set('$peak', 12);
  b.set('$peak', 20);
  a.step(0.25);
  b.step(0.5);
  expect(a.value('probe.r')).toBe(3);
  expect(b.value('probe.r')).toBe(10);
  a.set('$peak', 8);
  a.step(0);
  expect(a.value('probe.r')).toBe(2);
  expect(b.value('probe.r')).toBe(10);
  expect(m.timelines[0]!.tracks[0]!.values).toEqual(before);
});
it('samples independently created TimelineInstances against their owner', () => {
  const m = model();
  const a = new Player(m),
    b = new Player(m);
  a.set('$peak', 16);
  b.set('$peak', 24);
  a.createTimeline('rise').seek(0.5).apply();
  b.createTimeline('rise').seek(0.25).apply();
  a.step(0);
  b.step(0);
  expect(a.value('probe.r')).toBe(8);
  expect(b.value('probe.r')).toBe(6);
});
it('uses current endpoints with absolute value curves', () => {
  const p = new Player(
    model(source('$peak', 'ease="value-cubic(0.3333333333333333,0,0.6666666666666666,0)"')),
  );
  p.set('$peak', 16);
  p.step(0.5);
  // x handles make Bezier parameter u=.5; endpoint contribution is u^3*16.
  expect(p.value('probe.r')).toBeCloseTo(2, 9);
});
it('supports bool/color/discrete string data keys', () => {
  const xml = source()
    .replace('target="probe.r"', 'target="probe.fill"')
    .replace('value="0"', 'value="#f00"')
    .replace('value="$peak"', 'value="$tint"');
  const p = new Player(model(xml));
  p.step(0.5);
  expect(p.value('probe.fill.color')).toBe('#800080');
  const str = source()
    .replace('target="probe.r"', 'target="probe.channels.label"')
    .replace('<key t="0" value="0" />', '<key t="0" value="&quot;old&quot;"/>')
    .replace('value="$peak"', 'value="$label"');
  const s = new Player(model(str));
  s.step(1);
  expect(s.value('probe.channels.label')).toBe('new');
  const bool = source()
    .replace('target="probe.r"', 'target="probe.visible"')
    .replace('value="0"', 'value="false"')
    .replace('value="$peak"', 'value="$ready"');
  const b = new Player(model(bool));
  b.set('$ready', true);
  b.step(1);
  expect(b.value('probe.visible')).toBe(true);
});
it.each(['$ready', '$missing', '$label'])('rejects incompatible or unknown key value %s', (v) => {
  const d = compile(source(v)).diagnostics.find((d) => d.code === 'data-keyframe');
  expect(d).toMatchObject({ pointer: '/timelines/rise/tracks/probe.r/1/1' });
  expect(d?.message).toBeTruthy();
  expect(d?.hint).toBeTruthy();
});
it('rejects mixed markup key spellings without throwing', () => {
  expect(compile(source().replace('<key t="0"', '0 1; <key t="0"')).diagnostics).toContainEqual(
    expect.objectContaining({ code: 'bad-keyframe', hint: expect.any(String) }),
  );
  expect(compile(source().replace('t="0" value="0"', '')).doc).toBeUndefined();
});
it('validates live reference and integer channel values with complete diagnostics', () => {
  const reference = source('$label')
    .replace('target="probe.r"', 'target="probe.channels.label"')
    .replace('type="string" value=\'"old"\'', 'type="reference" value=\'"probe"\'')
    .replace('default="new"', 'default="probe"')
    .replace('<key t="0" value="0" />', '<key t="0" value="&quot;probe&quot;"/>');
  const r = new Player(model(reference));
  r.step(1);
  expect(r.value('probe.channels.label')).toBe('probe');
  const integer = source()
    .replace('target="probe.r"', 'target="probe.channels.label"')
    .replace('type="string" value=\'"old"\'', 'type="uint" value="0"');
  const i = new Player(model(integer));
  i.step(1);
  expect(i.value('probe.channels.label')).toBe(8);
  for (const [p, path, value] of [
    [r, '$label', 'missing'],
    [i, '$peak', 1.5],
    [i, '$peak', 4294967296],
  ] as const) {
    p.set(path, value);
    expect(() => p.step(0)).toThrowError(
      expect.objectContaining({
        code: 'data-keyframe',
        pointer: '/timelines/rise/tracks/probe.channels.label/1/1',
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
  }
});
it('preserves dollar-prefixed literal strings when data is not declared', () => {
  const r = load({
    anima: '0.1',
    name: 'literal-dollar',
    grid: 20,
    requires: ['motion'],
    nodes: [
      {
        id: 'node',
        type: 'group',
        children: [],
        channels: { label: { type: 'string', value: '$start' } },
      },
    ],
    timelines: {
      label: {
        duration: 1,
        tracks: {
          'node.channels.label': [
            [0, '$start'],
            [1, '$end'],
          ],
        },
      },
    },
    machine: { layers: { main: { initial: 'run', states: { run: { play: 'label' } } } } },
  });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  p.step(1);
  expect(p.value('node.channels.label')).toBe('$end');
});
it('element keys validate and omit final eases like text keys, retaining exact source locations', () => {
  const valid = compile(source().replace('value="$peak"/>', 'value="$peak" ease="linear"/>'));
  expect(valid.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect(
    (valid.doc!.timelines as Record<string, { tracks: Record<string, unknown[][]> }>).rise!.tracks[
      'probe.r'
    ]![1],
  ).toEqual([1, '$peak']);
  const bad = compile(source('$ready')).diagnostics.find((d) => d.code === 'data-keyframe');
  expect(bad?.line).toBe(4);
  expect(bad?.column).toBeGreaterThan(70);
  expect(
    compile(source().replace('value="$peak"/>', 'value="$peak" ease="misspelled"/>')).diagnostics,
  ).toContainEqual(expect.objectContaining({ code: 'bad-ease' }));
});
