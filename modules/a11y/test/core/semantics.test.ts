import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import '@anima-format/core/all';
import { load, Player, runScript } from '@anima-format/core';
import { compile, decompile } from '@anima-format/markup';
import type { SemanticNode } from '../../core/index.ts';
import { semanticDiff } from '../../../a11y-actions/core/index.ts';
const source = `<anima version="0.1" name="semantic-contract" grid="20" requires="a11y focus">
  <bool name="checked"/><bool name="mixed" default="true"/><bool name="hidden"/>
  <number name="volume" default="40"/>
  <group id="settings"><a11y role="group" label="Settings" bounds="0 0 20 20"/>
    <rect id="mute" x0="1" y0="2" width="3" height="4" fill="#000"><a11y role="checkbox" label="Mute" checked="checked" checked-mixed="mixed" hidden="hidden" bounds="1 2 3 4"/></rect>
    <rect id="volume" x0="5" y0="6" width="7" height="8" fill="#000"><a11y role="slider" label="Volume" value="volume" min="0" max="100" step="5" bounds="5 6 7 8"/></rect>
  </group>
</anima>`;
function player(text = source) {
  const r = compile(text);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const l = load(r.text!);
  expect(l.model).toBeTruthy();
  return new Player(l.model!);
}
describe('semantic tree contract', () => {
  it('matches the exported wave-2 JSON contract and round-trips both spellings', () => {
    const p = player();
    const contract: SemanticNode[] = JSON.parse(
      readFileSync(new URL('../fixtures/tree.json', import.meta.url), 'utf8'),
    );
    expect(p.semantics()).toEqual(contract);
    const d = compile(decompile(p.model.doc));
    expect(d.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(d.doc?.nodes).toEqual(p.model.doc.nodes);
  });
  it('reuses the tree when unrelated inputs change or an unchanged step runs', () => {
    const p = player(),
      tree = p.semantics();
    p.step(0);
    expect(p.semantics()).toBe(tree);
    p.set('checked', true);
    p.step(0);
    expect(p.semantics()).not.toBe(tree);
    const next = p.semantics();
    p.step(0);
    expect(p.semantics()).toBe(next);
  });
  it('performs tap, range steps and clamps; rejects unknown or unavailable actions', () => {
    const p = player();
    expect(p.semanticAction('mute', 'tap')).toBe(true);
    p.step(0);
    expect(p.get('checked')).toBe(true);
    expect(p.semanticAction('volume', 'increase')).toBe(true);
    p.step(0);
    expect(p.get('volume')).toBe(45);
    expect(p.semanticAction('volume', 'decrease')).toBe(true);
    p.step(0);
    expect(p.get('volume')).toBe(40);
    p.set('volume', 99);
    p.step(0);
    p.semanticAction('volume', 'increase');
    p.step(0);
    expect(p.get('volume')).toBe(100);
    expect(p.semanticAction('volume', 'increase')).toBe(false);
    expect(p.semanticAction('missing', 'tap')).toBe(false);
    expect(p.semanticAction('settings', 'tap')).toBe(false);
  });
  it('reports ancestor focus and retargets a hidden focused node', () => {
    const p = player(source.replace('<group id="settings">', '<group id="settings"><focus/>'));
    expect(p.semanticAction('mute', 'focus')).toBe(true);
    p.step(0);
    expect(p.semantics()[0]!.states.focused).toBe(true);
    p.set('hidden', true);
    p.step(0);
    expect(p.focused).toBe('settings');
    expect(p.semantics()[0]!.children.map((n) => n.id)).toEqual(['volume']);
  });
  it('emits stable diffs without treating descendant changes as parent changes', () => {
    const p = player(),
      prev = p.semantics();
    p.set('mixed', false);
    p.step(0);
    const next = p.semantics();
    expect(semanticDiff(prev, next)).toEqual({
      added: [],
      removed: [],
      changed: [{ id: 'mute', keys: ['states'] }],
    });
    expect(p.semanticDiff(next, [])).toEqual({
      added: [],
      removed: ['settings', 'mute', 'volume'],
      changed: [],
    });
  });
  it('headless commands inspect subtrees and attach semantics to snapshots', () => {
    const p = player();
    const r = runScript(p.model, 'semantic volume increase\nsnapshot --semantics\nsemantics mute');
    expect(
      (r.snapshots[0] as unknown as { semantics: SemanticNode[] }).semantics[0]!.children[1]!.value,
    ).toBe(45);
    expect((r.output[1] as SemanticNode).id).toBe('mute');
  });
  it('keeps the root a11y parser and schema intact', () => {
    const p = player(
      source.replace(
        '<bool name="checked"/>',
        '<a11y role="switch" label="Root" pressed="checked" activate="checked"/><bool name="checked"/>',
      ),
    );
    expect(p.model.doc.a11y).toEqual({
      role: 'switch',
      label: 'Root',
      pressed: 'checked',
      activate: 'checked',
    });
  });
});
export { source };
