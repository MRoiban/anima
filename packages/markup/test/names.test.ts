// seam(P8-4): account for the generic skin field used to diagnose unsupported hosts.
// seam(P8-5): account for the new mesh registry field and two conformance sources.
import '@anima-format/core/all';
import { describe, expect, it } from 'vitest';
import {
  COMMON,
  NODE_TYPES,
  OWN,
  PAINT,
  STATIC,
  nodeShape,
  type NodeType,
} from '@anima-format/core';
import { STRUCTURAL_NODE_KEYS, aniAddress, markupAddress, nodeAttrs } from '../src/names.ts';

describe('one registry, two spellings', () => {
  it('every .ani node key has exactly one AniML spelling', () => {
    for (const t of NODE_TYPES) {
      const covered = new Set(nodeAttrs(t).map((a) => a.path[0]));
      for (const k of Object.keys(nodeShape(t).p))
        // seam(P6-6): structural fields may belong to a single node type (text-input).
        if (!STRUCTURAL_NODE_KEYS.includes(k) && !nodeShape(t).p[k]?.element)
          expect(covered.has(k), `${t}.${k}`).toBe(true);
      const names = nodeAttrs(t).map((a) => a.attr);
      expect(new Set(names).size, `${t}: duplicate attribute names`).toBe(names.length);
    }
  });

  it('uses SVG names where SVG has them', () => {
    const attrs = (t: NodeType) => nodeAttrs(t).map((a) => a.attr);
    expect(attrs('circle')).toEqual(
      expect.arrayContaining([
        'cx',
        'cy',
        'r',
        'fill',
        'fill-rule',
        'stroke',
        'stroke-width',
        'stroke-linecap',
        'stroke-linejoin',
      ]),
    );
    expect(attrs('rect')).toEqual(expect.arrayContaining(['x0', 'y0', 'width', 'height', 'rx']));
    expect(attrs('group')).toEqual([
      'opaque',
      'cursor',
      'mesh',
      'mix-blend-mode',
      'properties',
      'mix',
      'pointerEnabled',
      'collapsed',
      'solo',
      'pivotX',
      'pivotY',
      'pivot',
      'x',
      'y',
      'rotate',
      'scale',
      'scaleX',
      'scaleY',
      'opacity',
      'visible',
      // seam(P7-2): registry-derived layout participant attributes.
      'layout-width',
      'layout-height',
      'min-width',
      'max-width',
      'min-height',
      'max-height',
      'align-self',
      'margin',
      'display',
      // seam(P7-4): participant reflow is a registry-derived attribute.
      'reflow',
    ]);
  });

  it('translates addresses both ways', () => {
    const types: Record<string, NodeType> = {
      dot: 'circle',
      bar: 'rect',
      wave: 'arc',
      icon: 'group',
    };
    const typeOf = (id: string) => types[id];
    const pairs: [string, string][] = [
      ['dot.fill', 'dot.fill.color'],
      ['wave.stroke-width', 'wave.stroke.width'],
      ['wave.trimEnd', 'wave.stroke.trimEnd'],
      ['bar.width', 'bar.w'],
      ['icon.scaleX', 'icon.scaleX'],
      ['dot.r', 'dot.r'],
    ];
    for (const [m, a] of pairs) {
      expect(aniAddress(m, typeOf)).toBe(a);
      expect(markupAddress(a, typeOf)).toBe(m);
    }
    expect(aniAddress('dot.nope', typeOf)).toBeUndefined();
    expect(aniAddress('ghost.x', typeOf)).toBeUndefined();
    expect(markupAddress('ghost.x', typeOf)).toBe('ghost.x');
  });

  it('animatable flags follow the registry', () => {
    for (const t of NODE_TYPES)
      for (const a of nodeAttrs(t)) {
        const k = a.path.at(-1)!;
        const anim =
          a.path.length === 2
            ? k in (PAINT[a.path[0] as 'fill' | 'stroke'] ?? {})
            : k in COMMON || k in OWN[t];
        expect(a.animatable, `${t}.${a.attr}`).toBe(anim);
      }
    expect(Object.keys(STATIC.circle)).toEqual([
      'center',
      'focus',
      'opaque',
      'cursor',
      'mesh',
      'channels',
      'blend',
      'mask',
      'clip',
      'drawOrder',
      'paints',
      'properties',
      'a11y',
      'slice',
      'mix',
      'layout',
      // seam(P8-1): ordered rig constraint field.
      'constraints',
      // seam(P8-4): all nodes accept skin structurally so unsupported hosts get rig-skin-host.
      'skin',
    ]);
  });
});
