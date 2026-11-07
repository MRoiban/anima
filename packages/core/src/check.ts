// Structural validation of a parsed document against the registry shapes.

import { type Diags, ptr, suggest } from './diag.ts';
import { VERBOSE as V } from './flags.ts';
import {
  DOC,
  DOC_NAME,
  NAME,
  NODE_TYPES,
  type NodeType,
  type ObjShape,
  type Shape,
  nodeShape,
} from './registry.ts';

const kind = (v: unknown): string => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

const shapeKind = (s: Shape): string =>
  s.k === 'str'
    ? 'string'
    : s.k === 'num'
      ? 'number'
      : s.k === 'bool'
        ? 'boolean'
        : s.k === 'arr' || s.k === 'tup'
          ? 'array'
          : s.k === 'any'
            ? 'any'
            : 'object';

const MAX_DEPTH = 96;

/** Check `value` against the document shape. Reports into `d`; returns false on any error. */
export function checkDoc(value: unknown, d: Diags): boolean {
  const before = d.list.length;
  const required = (value as { requires?: unknown })?.requires;
  d.features = Array.isArray(required) ? required : [];
  // Component libraries may omit a drawing at the document root.
  const shape = d.features.includes('components')
    ? { ...DOC, p: { ...(DOC as ObjShape).p, nodes: { ...(DOC as ObjShape).p.nodes, min: 0 } } }
    : DOC;
  check(value, shape as ObjShape, '', d, 0);
  return d.list.length === before;
}

function check(v: unknown, s: Shape, p: string, d: Diags, depth: number): void {
  if (depth > MAX_DEPTH) return d.err('limit-exceeded', p, V && 'nesting is too deep');
  if (s.feature && !s.feature.split('|').some((f) => d.features?.includes(f)))
    d.err(
      'undeclared-feature',
      p,
      V && `requires does not declare ${s.feature}`,
      V && `add "${s.feature.split('|').join('" or "')}" to "requires"`,
    );
  if (s.k === 'any') return;
  const k = kind(v);
  if (s.k === 'alt') {
    const hit = s.of.find((o) => shapeKind(o) === k);
    return hit
      ? check(v, hit, p, d, depth)
      : d.err('type', p, V && `expected ${s.of.map(shapeKind).join(' or ')}, got ${k}`);
  }
  if (k !== shapeKind(s) || (k === 'number' && !Number.isFinite(v)))
    return d.err('type', p, V && `expected ${shapeKind(s)}, got ${k}`);
  switch (s.k) {
    case 'str': {
      const str = v as string;
      if (s.re && !s.re.test(str)) {
        const name = s.re === NAME || s.re === DOC_NAME;
        return d.err(
          name ? 'bad-name' : 'bad-value',
          p,
          V && (name ? `"${str}" is not a valid name` : `"${str}" does not match ${s.re.source}`),
          V && name && `names match ${s.re.source}`,
        );
      }
      if (s.of && !s.of.includes(str))
        d.err(
          'bad-value',
          p,
          V && `"${str}" is not one of ${s.of.join(', ')}`,
          V && suggest(str, s.of),
        );
      return;
    }
    case 'num': {
      const n = v as number;
      // The type check above guarantees finite values; omitted limits are unbounded.
      if (n < (s.min ?? -Infinity) || n > (s.max ?? Infinity) || n <= (s.gt ?? -Infinity))
        return d.err('bad-value', p, V && `${n} is out of range`, V && rangeText(s));
      if (s.int && !Number.isInteger(n)) d.err('bad-value', p, V && `${n} is not an integer`);
      return;
    }
    case 'arr':
    case 'tup': {
      const a = v as unknown[];
      if ((s.min && a.length < s.min) || (s.k === 'tup' && a.length > s.of.length))
        return d.err(
          'bad-value',
          p,
          V &&
            (s.k === 'tup'
              ? `needs ${s.min === s.of.length ? s.min : `${s.min} to ${s.of.length}`} items, has ${a.length}`
              : `needs at least ${s.min} item${s.min! > 1 ? 's' : ''}`),
        );
      return a.forEach((x, i) =>
        check(x, s.k === 'arr' ? s.of : s.of[i]!, p + '/' + i, d, depth + 1),
      );
    }
    case 'map': {
      for (const [key, x] of Object.entries(v as object)) {
        const kp = ptr(p, key);
        if (key === '$comment') continue;
        if (s.key && !s.key.test(key))
          d.err(
            'bad-name',
            kp,
            V && `"${key}" is not a valid name`,
            V && `names match ${s.key.source}`,
          );
        else check(x, s.of, kp, d, depth + 1);
      }
      return;
    }
    case 'obj':
      return checkObj(v as Record<string, unknown>, s, p, d, depth);
    case 'node': {
      const o = v as Record<string, unknown>;
      if (!('type' in o))
        return d.err(
          'missing-key',
          p,
          V && 'node has no "type"',
          V && `one of ${NODE_TYPES.join(', ')}`,
        );
      if (typeof o.type !== 'string' || !NODE_TYPES.includes(o.type as NodeType))
        return d.err(
          'unknown-node-type',
          p + '/type',
          V && `unknown node type ${JSON.stringify(o.type)}`,
          V && (suggest(String(o.type), NODE_TYPES) ?? `one of ${NODE_TYPES.join(', ')}`),
        );
      return checkObj(o, nodeShape(o.type as NodeType), p, d, depth);
    }
  }
}

function checkObj(
  o: Record<string, unknown>,
  s: ObjShape,
  p: string,
  d: Diags,
  depth: number,
): void {
  for (const [key, x] of Object.entries(o)) {
    const kp = ptr(p, key);
    if (key === '$comment') {
      if (typeof x !== 'string') d.err('type', kp, V && `expected string, got ${kind(x)}`);
    } else if (Object.hasOwn(s.p, key)) check(x, s.p[key]!, kp, d, depth + 1);
    else if (s.reserved && Object.hasOwn(s.reserved, key))
      d.err('reserved', kp, V && `"${key}" is reserved: ${s.reserved[key]}`);
    else d.err('unknown-key', kp, V && `unknown key "${key}"`, V && suggest(key, Object.keys(s.p)));
  }
  for (const r of s.req ?? []) if (!(r in o)) d.err('missing-key', p, V && `missing "${r}"`);
}

function rangeText(s: { min?: number; max?: number; gt?: number }): string {
  if (s.gt !== undefined) return `must be > ${s.gt}`;
  if (s.min !== undefined && s.max !== undefined) return `must lie in [${s.min}, ${s.max}]`;
  return s.min !== undefined ? `must be ≥ ${s.min}` : `must be ≤ ${s.max}`;
}
