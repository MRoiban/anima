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
it('[P3b-10a] installs semantic focus after an already compiled cached read', () => {
  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import {registerModule,load,Player} from '@anima-format/core';
    import {a11y} from './modules/a11y/core/index.ts';
    import {a11yActions} from './modules/a11y-actions/core/index.ts';
    import {focus} from './modules/focus/core/index.ts';
    registerModule(a11y); registerModule(a11yActions);
    const {model}=load({anima:'0.1',name:'late',grid:20,requires:['a11y'],
      inputs:{on:{type:'bool'}}, nodes:[{id:'item',type:'group',a11y:{role:'button',activate:'on'}}]});
    const p=new Player(model), old=p.semantics(); registerModule(focus);
    console.log(JSON.stringify({old:old[0].actions,next:p.semantics()[0].actions,
      items:p.focusItems().map(n=>n.id),accepted:p.semanticAction('item','focus')}));
  `,
    ],
    { encoding: 'utf8' },
  );
  expect(JSON.parse(output)).toEqual({
    old: ['tap'],
    next: ['tap', 'focus'],
    items: ['item'],
    accepted: true,
  });
});
it('[P3b-10a] targets and traverses repeated semantic rows with world points and owner cleanup', () => {
  const p =
    player(`<anima version="0.1" name="repeats" grid="20" requires="a11y focus data components lists">
    <model name="M"><number name="n" default="2"/></model><instance name="main" model="M" default="true"/>
    <component name="row" grid="20"><group id="item"><a11y role="button" bounds="1 2 3 4"/></group></component>
    <repeat id="rows" component="row" count="$n" dx="5"><focus enabled="false" edge="parent-scope"/></repeat>
  </anima>`);
  p.step(0);
  expect(p.focusItems().map((n) => [n.id, n.point])).toEqual([
    ['rows.0.item', [2.5, 4]],
    ['rows.1.item', [7.5, 4]],
  ]);
  expect(p.semanticAction('rows.0.item', 'focus')).toBe(true);
  p.step(0);
  expect(p.machineFocus?.('rows.0.item')).toBe(true);
  expect(p.focusKey('Tab')).toBe(true);
  expect(p.focused).toBe('rows.1.item');
  expect(p.focusKey('Tab', true, true)).toBe(true);
  expect(p.focused).toBe('rows.0.item');
  expect(p.focusTraverse('right')).toBe(true);
  expect(p.focused).toBe('rows.1.item');
  p.set('$n', 1);
  p.step(0);
  expect(p.focused).toBe('rows.0.item');
  expect(p.semanticAction('rows.1.item', 'focus')).toBe(false);
});
it('[P3b-10a] routes actions to a replacement owner even when the tree signature is unchanged', () => {
  const p = player(`<anima version="0.1" name="owners" grid="20" requires="a11y components">
    <component name="button" grid="20"><bool name="on"/><group id="item"><a11y role="checkbox" checked="on"/></group></component>
    <instance id="first" component="button"/>
  </anima>`);
  p.step(0);
  const oldTree = p.semantics();
  const children = (p.nested as unknown as { players: Map<string, Player> }).players;
  const oldOwner = children.get('first')!;
  const nextOwner = new Player(oldOwner.model);
  children.set('first', nextOwner);
  expect(p.semantics()).toBe(oldTree);
  expect(p.semanticAction('first.item', 'tap')).toBe(true);
  nextOwner.step(0);
  oldOwner.step(0);
  expect(nextOwner.get('on')).toBe(true);
  expect(oldOwner.get('on')).toBe(false);
});
