// Canonical .ani text (`anima fmt`, and `anima build` output). Known keys in a stable order, maps (whose order can matter,
// e.g. layers) kept as written, arrays of plain values on one line — so each keyframe gets a line.

import { DOC, NODE_TYPES, type NodeType, type Shape, nodeShape } from './registry.ts';

const NODE_ORDER = [
  'id',
  'type',
  'glyph',
  'subpaths',
  'd',
  'center',
  'x0',
  'y0',
  'w',
  'h',
  'r',
  'rx',
  'from',
  'to',
  'pivot',
  'x',
  'y',
  'rotate',
  'scale',
  'scaleX',
  'scaleY',
  'opacity',
  'visible',
  'fill',
  'stroke',
  'knockout',
  'children',
];

const isPlain = (v: unknown) => v === null || typeof v !== 'object';

function order(keys: string[], wanted: string[]): string[] {
  const rank = (k: string) =>
    k === '$comment' ? -1 : wanted.indexOf(k) < 0 ? 1e6 : wanted.indexOf(k);
  return [...keys].sort((a, b) => rank(a) - rank(b));
}

function print(v: unknown, s: Shape | undefined, indent: string): string {
  if (isPlain(v)) return JSON.stringify(v);
  const inner = indent + '  ';
  if (Array.isArray(v)) {
    if (v.every(isPlain)) return `[${v.map((x) => JSON.stringify(x)).join(', ')}]`;
    const of = s?.k === 'arr' ? s.of : undefined;
    return `[\n${v.map((x, i) => inner + print(x, s?.k === 'tup' ? s.of[i] : of, inner)).join(',\n')}\n${indent}]`;
  }
  const o = v as Record<string, unknown>;
  let keys = Object.keys(o);
  let child = (_k: string): Shape | undefined => undefined;
  if (s?.k === 'node' && typeof o.type === 'string' && NODE_TYPES.includes(o.type as NodeType)) {
    const ns = nodeShape(o.type as NodeType);
    keys = order(keys, NODE_ORDER);
    child = (k) => ns.p[k];
  } else if (s?.k === 'obj') {
    keys = order(keys, Object.keys(s.p));
    child = (k) => s.p[k];
  } else if (s?.k === 'map') child = () => s.of;
  if (!keys.length) return '{}';
  return `{\n${keys.map((k) => `${inner}${JSON.stringify(k)}: ${print(o[k], child(k), inner)}`).join(',\n')}\n${indent}}`;
}

/** Canonical text of a parsed document. */
export function formatAni(doc: unknown): string {
  return print(doc, DOC, '') + '\n';
}
