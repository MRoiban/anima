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
        if (!STRUCTURAL_NODE_KEYS.includes(k)) expect(covered.has(k), `${t}.${k}`).toBe(true);
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
      'pivot',
      'x',
      'y',
      'rotate',
      'scale',
      'scaleX',
      'scaleY',
      'opacity',
      'visible',
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
            ? k in PAINT[a.path[0] as 'fill' | 'stroke']
            : k in COMMON || k in OWN[t];
        expect(a.animatable, `${t}.${a.attr}`).toBe(anim);
      }
    expect(Object.keys(STATIC.circle)).toEqual(['center']);
  });
});
