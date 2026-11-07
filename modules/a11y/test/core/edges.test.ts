import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { load, Player } from '@anima-format/core';
import { compile } from '@anima-format/markup';

function player(source: string) {
  const result = compile(source);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const loaded = load(result.doc!);
  expect(loaded.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(loaded.model!);
}
it('refreshes a cached static tree when the actions module registers late', () => {
  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { registerModule, load, Player } from '@anima-format/core';
    import { a11y } from './modules/a11y/core/index.ts';
    import { a11yActions } from './modules/a11y-actions/core/index.ts';
    registerModule(a11y);
    const { model } = load({ anima:'0.1', name:'late', grid:20, requires:['a11y'],
      inputs:{ on:{type:'bool'} }, nodes:[{id:'c',type:'group',a11y:{role:'checkbox',checked:'on'}}] });
    const p = new Player(model), old = p.semantics();
    registerModule(a11yActions);
    console.log(JSON.stringify([old[0].actions,p.semantics()[0].actions,p.semantics() !== old]));
  `,
    ],
    { encoding: 'utf8' },
  );
  expect(JSON.parse(output)).toEqual([[], ['tap'], true]);
});
it('does not advertise edits for readonly data or a readonly semantic control', () => {
  const p = player(`<anima version="0.1" name="readonly" grid="20" requires="a11y data">
    <model name="M"><bool name="on"/><number name="count" default="2"/><list name="items" of="M"/></model>
    <instance name="main" model="M" default="true"/>
    <group id="count"><a11y role="slider" value="$count" readonly="true"/></group>
    <group id="flag"><a11y role="checkbox" checked="$on" readonly="true"/></group>
    <group id="size"><a11y role="slider" value="$items.length"/></group>
  </anima>`);
  expect(p.semantics().map((n) => n.actions)).toEqual([['focus'], ['focus'], ['focus']]);
  expect(p.semanticAction('count', 'increase')).toBe(false);
  expect(p.semanticAction('flag', 'tap')).toBe(false);
  expect(p.semanticAction('size', 'decrease')).toBe(false);
});
it('applies two queued semantic taps as two toggles, including data bindings', () => {
  const p = player(`<anima version="0.1" name="toggle" grid="20" requires="a11y data">
    <model name="M"><bool name="on"/></model><instance name="main" model="M" default="true"/>
    <group id="flag"><a11y role="checkbox" checked="$on"/></group>
  </anima>`);
  expect(p.semanticAction('flag', 'tap')).toBe(true);
  expect(p.semanticAction('flag', 'tap')).toBe(true);
  p.step(0);
  expect(p.get('$on')).toBe(false);
  p.semanticAction('flag', 'tap');
  p.step(0);
  expect(p.get('$on')).toBe(true);
});
it('interleaves transparent nested instances and repeated rows with authored siblings', () => {
  const p =
    player(`<anima version="0.1" name="order" grid="20" requires="a11y data components lists">
    <model name="M"><number name="n" default="2"/></model><instance name="main" model="M" default="true"/>
    <component name="leaf" grid="20"><group id="item"><a11y role="text" label="Item" bounds="0 0 1 1"/></group></component>
    <component name="wrapper" grid="20"><instance id="inner" component="leaf"/></component>
    <instance id="first" component="wrapper"/>
    <group id="middle"><a11y role="text" label="Middle" bounds="0 0 1 1"/></group>
    <repeat id="rows" component="leaf" count="$n"/>
    <group id="last"><a11y role="text" label="Last" bounds="0 0 1 1"/></group>
  </anima>`);
  p.step(0);
  expect(p.semantics().map((n) => n.id)).toEqual([
    'first.inner.item',
    'middle',
    'rows.0.item',
    'rows.1.item',
    'last',
  ]);
  const old = p.semantics();
  p.set('$n', 1);
  p.step(0);
  expect(p.semantics()).not.toBe(old);
  expect(p.semantics().map((n) => n.id)).toEqual([
    'first.inner.item',
    'middle',
    'rows.0.item',
    'last',
  ]);
});
