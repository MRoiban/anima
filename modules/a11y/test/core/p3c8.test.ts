import '@anima-format/core/all';
import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { load, Player } from '@anima-format/core';
import { compile } from '@anima-format/markup';

it('[P3c-8] unchanged and unrelated-input reads do no scene collection or signature work', () => {
  const { doc, diagnostics } =
    compile(`<anima version="0.1" name="dependencies" grid="20" requires="a11y focus data">
    <bool name="unused"/><bool name="hide"/><bool name="enabled" default="true"/>
    <model name="M"><string name="label" default="Before"/></model><instance name="main" model="M" default="true"/>
    <circle id="item" cx="2" cy="3" r="1" fill="#000"><a11y role="button" label="$label" hidden="hide"/><focus enabled-input="enabled"/></circle>
  </anima>`);
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(load(doc!).model!);
  const old = p.semantics();
  const world = vi.spyOn(p, 'world');
  const stringify = vi.spyOn(JSON, 'stringify');
  expect(p.semantics()).toBe(old);
  p.set('unused', true);
  p.step(0);
  expect(p.semantics()).toBe(old);
  expect(world).not.toHaveBeenCalled();
  expect(stringify).not.toHaveBeenCalled();
  stringify.mockRestore();
  p.set('$label', 'After');
  p.step(0);
  expect(p.semantics()[0]!.label).toBe('After');
  expect(p.semantics()[0]!.actions).toContain('focus');
  p.set('enabled', false);
  p.step(0);
  expect(p.semantics()[0]!.actions).not.toContain('focus');
  p.set('hide', true);
  p.step(0);
  expect(p.semantics()).toEqual([]);
});

it('[P3c-8] directional peers use painted centers and reproduce native right then next', () => {
  const result = load(
    readFileSync(new URL('../../examples/focus-ancestor-policy.ani', import.meta.url), 'utf8'),
  );
  const p = new Player(result.model!);
  p.semanticAction('child', 'focus');
  p.step(0);
  expect(p.focusTraverse('right')).toBe(true);
  p.step(0);
  expect(p.focused).toBe('sibling');
  expect(p.focusItems().find((n) => n.id === 'child')!.point).toEqual([10, 10]);
  expect(p.focusTraverse('next')).toBe(true);
  p.step(0);
  expect(p.focused).toBe('outside');
  for (const stage of ['right', 'outside']) {
    const native = JSON.parse(
      readFileSync(
        new URL(`../../oracle/focus-policy/frames/${stage}.json`, import.meta.url),
        'utf8',
      ),
    );
    const flatten = (nodes: typeof native.roots): typeof native.roots =>
      nodes.flatMap((n: { children: typeof native.roots }) => [n, ...flatten(n.children)]);
    const expected = flatten(native.roots)
      .filter(
        (n: { stateFlags: number; children: unknown[] }) =>
          n.stateFlags & 128 && !n.children.length,
      )
      .map((n: { label: string }) => n.label);
    expect(expected).toEqual([stage === 'right' ? 'sibling' : 'outside']);
  }
});

it('[P3c-8] paint-only changes and unchanged list steps do not recollect; geometry and topology do', () => {
  const result =
    compile(`<anima version="0.1" name="precise-dependencies" grid="20" requires="a11y data bind components lists">
    <model name="M"><number name="alpha" default="1"/><number name="x" default="0"/><number name="n" default="2"/></model><instance name="main" model="M" default="true"/>
    <circle id="dot" cx="2" cy="2" r="1" fill="#000"><a11y role="img"/></circle>
    <component name="row" grid="20"><group id="item"><a11y role="text" bounds="0 0 2 2"/></group></component>
    <repeat id="rows" component="row" count="$n"/>
    <bind target="dot.opacity" value="$alpha"/><bind target="dot.x" value="$x"/>
  </anima>`);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(load(result.doc!).model!);
  p.step(0);
  const tree = p.semantics(),
    world = vi.spyOn(p, 'world');
  p.step(0);
  p.set('$alpha', 0.5);
  p.step(0);
  expect(p.semantics()).toBe(tree);
  // Lists map their own draw boxes using world(rows); collection would also visit dot.
  expect(world.mock.calls.some(([node]) => node === 0)).toBe(false);
  p.set('$x', 5);
  p.step(0);
  expect(p.semantics()[0]!.bounds).toEqual([6, 1, 2, 2]);
  expect(world).toHaveBeenCalled();
  p.set('$n', 1);
  p.step(0);
  expect(p.semantics().map((n) => n.id)).toEqual(['dot', 'rows.0.item']);
});

it('[P3c-8] list reordering refreshes action owners even when semantic signatures match', async () => {
  const { dataState } = await import('../../../data/core/index.ts');
  const { listState } = await import('../../../lists/core/index.ts');
  const result =
    compile(`<anima version="0.1" name="reordered-owners" grid="20" requires="a11y data components lists">
    <model name="Row"><number name="key"/></model><model name="Board"><list name="rows" of="Row"/></model>
    <instance name="main" model="Board" default="true"><set path="rows" value="[{&quot;key&quot;:1},{&quot;key&quot;:2}]"/></instance>
    <component name="row" grid="20" data="Row"><bool name="on"/><group id="item"><a11y role="button" activate="on"/></group></component>
    <repeat id="rows" list="$rows" component="row"/>
  </anima>`);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(load(result.doc!).model!);
  p.step(0);
  const tree = p.semantics();
  const [first, second] = listState(p)!.runs[0]!.items.map((i) => i.player);
  (dataState(p)!.read('$rows') as object[]).reverse();
  p.step(0);
  expect(p.semantics()).toBe(tree);
  expect(p.semanticAction('rows.0.item', 'tap')).toBe(true);
  p.step(0);
  expect(second!.get('on')).toBe(true);
  expect(first!.get('on')).toBe(false);
});

it('[P3c-8] matches native ancestor-condition marker pixels through entry, traversal, departure and hide', async () => {
  const { markerPixels, stages } = await import('../../oracle/p3c8-condition/verify.ts');
  const doc = JSON.parse(
    readFileSync(new URL('../../examples/focus-ancestor-policy.ani', import.meta.url), 'utf8'),
  );
  doc.requires.push('input', 'machine');
  doc.nodes.push({
    id: 'marker',
    type: 'rect',
    x0: -1,
    y0: -1,
    w: 2,
    h: 2,
    x: 90,
    y: 30,
    fill: { color: '#111' },
  });
  const on = (focused: boolean, to: string) => [
    { when: '@after(0)', to, guard: { left: { focus: 'parent' }, op: '==', right: focused } },
  ];
  doc.machine = {
    layers: {
      condition: {
        initial: 'idle',
        states: {
          idle: { pose: { 'marker.x': 90 }, on: on(true, 'focused') },
          focused: { pose: { 'marker.x': 70 }, on: on(false, 'idle') },
        },
      },
    },
  };
  const loaded = load(doc);
  expect(loaded.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(loaded.model!);
  const actions = [
    () => p.semanticAction('child', 'focus'),
    () => p.semanticAction('parent', 'focus'),
    () => p.focusTraverse('next'),
    () => p.focusTraverse('right'),
    () => p.focusTraverse('next'),
    () => {
      p.semanticAction('child', 'focus');
      p.set('hideChild', true);
    },
  ];
  for (const [i, stage] of stages.entries()) {
    actions[i]!();
    p.step(0);
    expect(p.value('marker.x'), stage).toBe(markerPixels(stage)[0]! + 1);
  }
});
