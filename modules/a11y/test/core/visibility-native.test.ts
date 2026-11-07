import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';
import { compile } from '@anima-format/markup';

it('[P3c-8] matches native hidden/collapsed/Solo membership while retaining transparent semantics', () => {
  const native = JSON.parse(
    readFileSync(new URL('../../oracle/p3c8-visibility/frames/tree.json', import.meta.url), 'utf8'),
  );
  const { doc, diagnostics } =
    compile(`<anima version="0.1" name="visibility" grid="100" requires="a11y data bind">
    <model name="M"><bool name="second" default="true"/></model><instance name="main" model="M" default="true"/>
    <rect id="visible" x0="8" y0="8" width="4" height="4" fill="#000"><a11y role="text" label="visible"/></rect>
    <rect id="transparent" x0="18" y0="8" width="4" height="4" opacity="0" fill="#000"><a11y role="text" label="transparent"/></rect>
    <group id="hidden-group"><a11y role="group" label="hidden-group" hidden="true"/>
      <rect id="hidden-child" x0="28" y0="8" width="4" height="4" fill="#000"><a11y role="text" label="hidden-child"/></rect>
    </group>
    <rect id="hidden-drawable" visible="false" x0="38" y0="8" width="4" height="4" fill="#000"><a11y role="text" label="hidden-drawable"/></rect>
    <group id="choice"><a11y role="group" label="choice"/>
      <rect id="inactive" x0="48" y0="8" width="4" height="4" fill="#000"><a11y role="text" label="inactive"/></rect>
      <rect id="active" x0="58" y0="8" width="4" height="4" fill="#000"><a11y role="text" label="active"/></rect>
    </group>
    <bind target="inactive.visible" value="not $second"/><bind target="active.visible" value="$second"/>
  </anima>`);
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(load(doc!).model!);
  p.step(0);
  const projection = (nodes: { label?: string; children: unknown[] }[]): string[] =>
    nodes.flatMap((n) => [n.label!, ...projection(n.children as typeof nodes)]).sort();
  expect(projection(p.semantics())).toEqual(projection(native.roots));
  expect(p.semantics().find((n) => n.id === 'choice')!.bounds).toEqual([58, 8, 4, 4]);
  p.set('$second', false);
  p.step(0);
  const first = JSON.parse(
    readFileSync(
      new URL('../../oracle/p3c8-visibility/solo-first/frames/tree.json', import.meta.url),
      'utf8',
    ),
  );
  expect(projection(p.semantics())).toEqual(projection(first.roots));
  expect(p.semantics().find((n) => n.id === 'choice')!.bounds).toEqual([48, 8, 4, 4]);
  p.set('$second', true);
  p.step(0);
  expect(projection(p.semantics())).toEqual(projection(native.roots));
  // Native keeps the zero-opacity node with null bounds and sorts it last.
  // Anima retains its geometry and authored order; numbered in P3C8-FINDINGS.md.
  expect(native.roots.at(-1)).toMatchObject({ label: 'transparent', bounds: null });
  expect(p.semantics().find((n) => n.id === 'transparent')!.bounds).toEqual([18, 8, 4, 4]);
});
