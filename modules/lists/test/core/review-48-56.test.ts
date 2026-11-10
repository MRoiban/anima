// Rottweiler review of issues #48–#56, round 2 (design/rottweiler/ISSUES-48-56-LEDGER.md).
import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';
import { compile } from '@anima-format/markup';
import { listState } from '../../core/index.ts';

const player = (source: string) => {
  const built = compile(source);
  expect(built.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(load(built.doc!).model!);
};
const rows = (p: Player) => listState(p)!.runs[0]!.items.map((item) => item.player);

it('R2-1: a data-less leaf repeated inside a component with its own data reads that context', () => {
  const doc = {
    anima: '0.1',
    name: 'nested-own',
    grid: 20,
    requires: ['components', 'data', 'bind', 'lists'],
    data: {
      models: {
        Root: { properties: { n: { type: 'number', default: 1 } } },
        Other: { properties: { value: { type: 'number' } } },
      },
      instances: {
        main: { model: 'Root', default: true },
        other: { model: 'Other', values: { value: 8 } },
      },
    },
    components: {
      outer: {
        grid: 20,
        data: {
          models: {
            Root: { properties: { n: { type: 'number', default: 1 } } },
            Other: { properties: { value: { type: 'number' } } },
          },
          instances: {
            main: { model: 'Root', default: true },
            other: { model: 'Other', values: { value: 99 } },
          },
        },
        nodes: [{ id: 'leaves', type: 'repeat', count: '$n', component: 'leaf' }],
      },
      leaf: {
        grid: 10,
        nodes: [{ id: 'dot', type: 'circle', center: [2, 2], r: 1 }],
        bind: { 'dot.y': '$other:value' },
      },
    },
    nodes: [{ id: 'box', type: 'instance', component: 'outer' }],
  };
  const result = load(doc);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(result.model!);
  p.step(0);
  p.step(0);
  const outer = (p.nested as unknown as { players: Map<string, Player> }).players.get('box')!;
  const leaf = listState(outer)!.runs[0]!.items[0]!.player;
  expect(leaf.values()['dot.y']).toBe(99);
});

it('R2-2: a focus change reaches a repeated item machine guarded by focus', () => {
  const p =
    player(`<anima version="0.1" name="focus-rows" grid="20" requires="components data bind lists a11y focus input machine">
  <model name="Item"><number name="v"/></model>
  <model name="Board"><list name="items" of="Item"/></model>
  <instance name="main" model="Board" default="true"><set path="items" value='[{"v":1}]'/></instance>
  <component name="row" grid="10" data="Item">
    <group id="item"><focus/><a11y role="button" bounds="0 0 4 4"/></group>
    <layer name="l" initial="idle">
      <state name="idle"><on when="@after(0)" to="focused" guard="{&quot;left&quot;:{&quot;focus&quot;:&quot;item&quot;},&quot;right&quot;:true,&quot;op&quot;:&quot;==&quot;}"/></state>
      <state name="focused"/>
    </layer>
  </component>
  <repeat id="rows" list="$items" component="row"/>
</anima>`) as Player & { focusTarget(id: string): boolean };
  for (let i = 0; i < 4; i++) p.step(0);
  expect(p.focusTarget('rows.0.item')).toBe(true);
  p.step(0);
  p.step(0);
  expect(rows(p)[0]!.states()['l']).toBe('focused');
});

it('R2-2: a pointer press reaches a component nested in a repeated item', () => {
  const p =
    player(`<anima version="0.1" name="nested-press" grid="20" requires="components data bind lists input events">
  <model name="Item"><number name="v"/></model>
  <model name="Board"><list name="items" of="Item"/></model>
  <instance name="main" model="Board" default="true"><set path="items" value='[{"v":1}]'/></instance>
  <component name="inner" grid="20">
    <rect id="r" x0="0" y0="0" width="20" height="20" fill="#000"/>
    <listener on="down" target="r" emit="hit"/>
  </component>
  <component name="row" grid="20" data="Item">
    <instance id="in" component="inner"/>
  </component>
  <repeat id="rows" list="$items" component="row" size="20 20"/>
</anima>`);
  for (let i = 0; i < 4; i++) p.step(0);
  p.pointer('down', 5, 5);
  const r = p.step(0);
  expect(r.events.map((e) => e.name).join(' ')).toContain('hit');
});
