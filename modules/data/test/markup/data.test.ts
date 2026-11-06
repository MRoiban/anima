import '@anima-format/core/all';
import { it, expect } from 'vitest';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
const xml = `<anima version="0.1" name="model-example" grid="20" requires="data bind"><model name="Player"><number name="score" default="2"/><string name="name" default="Ada"/><bool name="online"/><color name="tint" default="#d97757"/><trigger name="levelUp"/><enum name="mood" values="calm happy angry" default="calm"/><list name="items" of="Item"/><model-ref name="team" model="Team"/><asset-ref name="avatar" type="image"/></model><model name="Item"><string name="title" default="hello"/></model><model name="Team"><string name="name" default="Blue"/></model><instance name="main" model="Player" default="true" exported="true"><set path="score" value="12"/></instance><circle id="dot" cx="10" cy="10" r="1" data-label="x"/><bind target="dot.x" value="$score" mode="two-way" prefer="source"/><listener on="click" copy="$score -> $main:score"/></anima>`;
it('compiles the decided model syntax and round-trips all property types', () => {
  const r = compile(xml);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect(r.doc).toBeDefined();
  expect(compile(decompile(r.doc!)).doc).toEqual(r.doc);
});
it('preserves editor metadata and enum display labels through generic data metadata', () => {
  const r = compile(xml);
  const doc = r.doc! as { data: Record<string, unknown> };
  doc.data.preview = 'main';
  doc.data.enums = {
    Mood: [
      { key: 'calm', label: 'Calm' },
      { key: 'happy', label: 'Happy' },
    ],
  };
  expect(compile(decompile(doc)).doc).toEqual(doc);
});
it('preserves per-component public model names', () => {
  const source = xml
    .replace('data bind', 'data bind components')
    .replace(
      '<circle id="dot"',
      '<component name="badge" grid="20" data="Player"><circle id="inner" cx="10" cy="10" r="1"/></component><circle id="dot"',
    );
  const r = compile(source);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect(compile(decompile(r.doc!)).doc).toEqual(r.doc);
});
it('keeps case-sensitive model property paths valid in actions, trigger lists and guards', () => {
  const source =
    '<anima version="0.1" name="case-paths" grid="20" requires="data bind"><model name="Root"><number name="Score"/><bool name="Online" default="true"/><trigger name="Ping"/></model><circle id="dot" cx="10" cy="10" r="1" fill="#000"/><listener on="click" set="$Score=$Score+1" fire="$Ping"/><layer name="m" initial="a"><state name="a"><pose/><on when="$Online" to="b"/></state><state name="b"><pose/></state></layer></anima>';
  const r = compile(source);
  expect(r.diagnostics).toEqual([]);
  expect(compile(decompile(r.doc!)).doc).toEqual(r.doc);
});
