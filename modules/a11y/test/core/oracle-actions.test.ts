import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { load, runScript } from '@anima-format/core';
import type { SemanticNode } from '../../core/types.ts';
const root = new URL('../../oracle/roles/actions/', import.meta.url);
const read = (file: string) => readFileSync(new URL(file, root), 'utf8');
it('[P3b-9] compares 64 native nodes around tap/increase/decrease; records three native focus differences', () => {
  const model = load(read('case.ani')).model!;
  const { snapshots } = runScript(model, read('script.txt'));
  const differences: unknown[] = [];
  for (const [i, frame] of ['before', 'tap', 'increase', 'decrease'].entries()) {
    const native = JSON.parse(read(`frames/${frame}.json`)).roots as {
      label: string;
      role: string;
      traitFlags: number;
      stateFlags: number;
      value: string;
      bounds: { x: number; y: number; width: number; height: number };
    }[];
    const actual = snapshots[i]!.semantics as SemanticNode[];
    expect(actual).toHaveLength(16);
    const names: Record<string, string> = {
      switchControl: 'switch',
      radioButton: 'radio',
      radioGroup: 'radio-group',
      tabList: 'tab-list',
      listItem: 'list-item',
      alertDialog: 'alert-dialog',
      image: 'img',
    };
    expect(actual.map((n) => n.role)).toEqual(native.map((n) => names[n.role] ?? n.role));
    expect(native).toHaveLength(16);
    // Native capability bits remain present with false states and after actions.
    expect(native.map((n) => n.traitFlags)).toEqual([
      104, 100, 104, 100, 32, 96, 98, 0, 96, 0, 64, 1, 0, 0, 0, 0,
    ]);
    for (const [j, n] of actual.entries()) {
      const ref = native[j]!,
        f = ref.stateFlags;
      expect(n.label).toBe(ref.label);
      expect(n.bounds).toEqual([ref.bounds.x, ref.bounds.y, ref.bounds.width, ref.bounds.height]);
      expect(n.states.checked ?? false).toBe(
        n.role === 'switch' ? !!(f & 16) : f & 8 ? 'mixed' : !!(f & 4),
      );
      for (const [key, bit] of [
        ['pressed', 16],
        ['selected', 2],
        ['expanded', 1],
        ['disabled', 64],
      ] as const)
        expect(n.states[key] ?? false).toBe(
          key === 'pressed' ? n.role === 'button' && !!(f & bit) : !!(f & bit),
        );
      if (n.role === 'slider') expect(String(n.value)).toBe(ref.value);
      if ((n.states.focused ?? false) !== !!(f & 128))
        differences.push({ frame, id: n.id, anima: n.states.focused, native: !!(f & 128) });
    }
  }
  expect(differences).toEqual(
    ['tap', 'increase', 'decrease'].map((frame) => ({
      frame,
      id: 'button',
      anima: true,
      native: false,
    })),
  );
});
it('[P3b-9] compares native property/mixed/required/readonly/hidden projections and records none/modal seams', () => {
  const reference = ['before', 'after'].map(
    (frame) =>
      JSON.parse(
        readFileSync(
          new URL(`../../oracle/roles/properties/frames/${frame}.json`, import.meta.url),
          'utf8',
        ),
      ).roots as {
        role: string;
        label: string;
        hint: string;
        value: string;
        headingLevel: number;
        stateFlags: number;
        children: unknown[];
      }[],
  );
  const snapshots = (name: string) => {
    const dir = new URL(`../../../../spec/conformance/a11y-${name}/`, import.meta.url);
    return runScript(
      load(readFileSync(new URL('case.ani', dir), 'utf8')).model!,
      readFileSync(new URL('script.txt', dir), 'utf8'),
    ).snapshots.map((s) => s.semantics as SemanticNode[]);
  };
  const props = snapshots('properties-data');
  for (const [i, nodes] of reference.entries()) {
    const copy = nodes.find((n) => n.role === 'text' && n.headingLevel === 0)!;
    expect({
      label: props[i]![0]!.label,
      hint: props[i]![0]!.hint,
      value: props[i]![0]!.value,
    }).toEqual({ label: copy.label, hint: copy.hint, value: copy.value });
    const check = nodes.find((n) => n.role === 'checkbox')!;
    const bits = check.stateFlags;
    expect(snapshots('state-checked-mixed')[i]![1]!.states.checked ?? false).toBe(
      bits & 8 ? 'mixed' : false,
    );
    expect(snapshots('state-required')[i]![1]!.states.required).toBe(!!(bits & 32));
    expect(snapshots('state-readonly')[i]![1]!.states.readonly).toBe(!!(bits & 1024));
    expect(snapshots('state-hidden')[i]!.some((n) => n.id === 'item')).toBe(
      nodes.some((n) => n.label === 'hidden'),
    );
    expect(snapshots('role-heading')[0]![0]!.level).toBe(
      nodes.find((n) => n.label === 'heading')!.headingLevel,
    );
    // Native exposes a role-none wrapper, while Anima lifts its child by design.
    expect(nodes.find((n) => n.role === 'none')!.children).toHaveLength(1);
    expect(snapshots('role-none')[0]!.map((n) => n.role)).toEqual(['text']);
  }
  // Native's modal flag remains descriptive; Anima deliberately prunes modal siblings.
  expect(reference[1]).toHaveLength(6);
  expect(reference[1].find((n) => n.label === 'modal')!.stateFlags & 2048).toBe(2048);
  expect(snapshots('state-modal')[1]!.map((n) => n.id)).toEqual(['item']);
});
it('[P3b-9] matches heading level 2→4 against a native data binding changed by semantic tap', () => {
  const dir = new URL('../../../../spec/conformance/a11y-property-heading-level/', import.meta.url);
  const snapshots = runScript(
    load(readFileSync(new URL('case.ani', dir), 'utf8')).model!,
    readFileSync(new URL('script.txt', dir), 'utf8'),
  ).snapshots;
  const levels = ['before', 'after'].map((frame) => {
    const raw = JSON.parse(
      readFileSync(
        new URL(`../../oracle/roles/heading/frames/${frame}.json`, import.meta.url),
        'utf8',
      ),
    );
    return raw.roots.find((n: { label: string; headingLevel: number }) => n.label === 'heading')
      .headingLevel as number;
  });
  expect(levels).toEqual([2, 4]);
  expect(snapshots.map((s) => (s.semantics as SemanticNode[])[0]!.level)).toEqual(levels);
});
