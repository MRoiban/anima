// Independent geometry constructions; SVG path grammar, no Rive source.
import { cornerPath, cornerEntries, cornerModel } from '../../corners/core/index.ts';
import { outline, type Point } from '../../corners/core/outline.ts';
import type { Module, ModuleEntry } from '../../../packages/core/src/modules.ts';
import type { Shape, Prop } from '../../../packages/core/src/registry.ts';
import { flatten, parsePath } from '../../../packages/core/src/path.ts';
import { fmt } from '../../../packages/core/src/draw.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';

const num = (min?: number): Shape => ({ k: 'num', min });
const shape = (
  target: string,
  fields: string[],
  positive: string[],
  defaults: Record<string, number> = {},
): ModuleEntry => ({
  target,
  node: { painted: true },
  shapes: Object.fromEntries(fields.map((k) => [k, num(positive.includes(k) ? 0 : undefined)])),
  props: Object.fromEntries(
    fields.map((k) => [
      k,
      { type: 'number', min: positive.includes(k) ? 0 : undefined, def: defaults[k] } as Prop,
    ]),
  ),
  required: ['id', 'type', ...fields.filter((k) => defaults[k] === undefined)],
});
const entries: ModuleEntry[] = [
  { target: 'path', shapes: {}, props: { d: { type: 'path' } }, required: ['id', 'type'] },
  shape('ellipse', ['cx', 'cy', 'rx', 'ry'], ['rx', 'ry']),
  shape(
    'polygon',
    ['cx', 'cy', 'sides', 'radius', 'rotation', 'cornerRadius'],
    ['radius', 'cornerRadius'],
    { rotation: 0, cornerRadius: 0 },
  ),
  shape(
    'star',
    ['cx', 'cy', 'points', 'radius', 'innerRadius', 'cornerRadius'],
    ['radius', 'innerRadius', 'cornerRadius'],
    { cornerRadius: 0 },
  ),
  shape('triangle', ['x0', 'y0', 'width', 'height'], ['width', 'height']),
  ...cornerEntries,
  {
    target: 'stroke',
    shapes: { scale: { k: 'str', of: ['normal', 'fixed'], markup: 'stroke-scale' } },
  },
];
for (const e of entries) {
  const k = e.target === 'polygon' ? 'sides' : e.target === 'star' ? 'points' : '';
  if (k) {
    e.shapes[k] = { k: 'num', min: k === 'sides' ? 3 : 2, max: 1024, int: true };
    Object.assign(e.props![k]!, { min: k === 'sides' ? 3 : 2, max: 1024 });
  }
}

// Expand implicit command repetitions. Arc flags are individual digits, including packed flags.
function segments(d: string): { command: string; values: number[] }[] {
  const out: { command: string; values: number[] }[] = [];
  let i = 0,
    command = '';
  const arity: Record<string, number> = {
    m: 2,
    l: 2,
    h: 1,
    v: 1,
    c: 6,
    s: 4,
    q: 4,
    t: 2,
    a: 7,
    z: 0,
  };
  while (i < d.length) {
    while (/[\s,]/.test(d[i] ?? '') && i < d.length) i++;
    if (i === d.length) break;
    if (/[a-z]/i.test(d[i]!)) command = d[i++]!;
    const values: number[] = [];
    const lc = command.toLowerCase();
    for (let k = 0; k < arity[lc]!; k++) {
      while (/[\s,]/.test(d[i] ?? '') && i < d.length) i++;
      const token =
        lc === 'a' && (k === 3 || k === 4)
          ? d[i]!
          : /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(d.slice(i))![0];
      values.push(+token);
      i += token.length;
    }
    out.push({ command, values });
    if (lc === 'm') command = command === 'm' ? 'l' : 'L';
  }
  return out;
}

export const geometry: Module = {
  name: 'paint',
  entries,
  model(n, key) {
    if (key === 'd' && n.type === 'path' && n.d !== undefined)
      return { prop: { type: 'path', feature: 'paint' }, rest: n.d! };
    return cornerModel(n, key);
  },
  value(addr, value, pointer, diag) {
    if (typeof value !== 'string')
      return diag.err(
        'value-type',
        pointer,
        V && 'expected path data',
        V && 'use an SVG path string',
      );
    try {
      parsePath(value);
    } catch {
      return diag.err(
        'bad-path',
        pointer,
        V && 'invalid morph path',
        V && 'use valid SVG path data',
      );
    }
    const a = segments(addr.rest as string),
      b = segments(value);
    const different = Array.from({ length: Math.max(a.length, b.length) }, (_, i) => i).find(
      (i) => a[i]?.command !== b[i]?.command,
    );
    if (different !== undefined)
      return diag.err(
        'morph-mismatch',
        pointer,
        V && 'path command structures differ',
        V &&
          `match segment ${different}: expected ${a[different]?.command ?? 'end'}, got ${b[different]?.command ?? 'end'}`,
      );
    return value;
  },
  interpolate(a, b, w) {
    // seam(P8-1): string-valued module slots are not necessarily SVG paths (rig origin tuples).
    if (
      typeof a !== 'string' ||
      typeof b !== 'string' ||
      !/^\s*[mM]/.test(a) ||
      !/^\s*[mM]/.test(b)
    )
      return;
    const aa = segments(a),
      bb = segments(b);
    return aa
      .map(
        (s, i) =>
          s.command +
          s.values
            .map((v, j) => {
              const n = v + (bb[i]!.values[j]! - v) * w;
              return fmt(
                s.command.toLowerCase() === 'a' && (j === 3 || j === 4) ? (n < 0.5 ? 0 : 1) : n,
              );
            })
            .join(' '),
      )
      .join('');
  },
  outline(p, i) {
    const n = p.model.nodes[i]!;
    // seam(P8-4): skin owns the deformed path outline for hit testing.
    if (n.raw.skin) return;
    if (
      !entries.some((e) => e.node && e.target === n.type) &&
      // seam(P7-2): another module may own corners on its own node type.
      !(n.type === 'rect' && n.raw.corners) &&
      !(n.type === 'path' && p.addrs.includes(n.id + '.d'))
    )
      return;
    return flatten(parsePath(cornerPath(p, i) ?? sampledPath(p, i)!));
  },
  draw: {
    tree(model, tree) {
      model.nodes.forEach((n, i) => {
        if (entries.some((e) => e.node && e.target === n.type) || n.raw.corners)
          tree.nodes[i]!.kind = 'path';
      });
    },
    frame(p, i, data) {
      const d = cornerPath(p, i) ?? sampledPath(p, i);
      if (d !== undefined) data.geometry = { kind: 'path', d };
    },
  },
};
function sampledPath(p: Player, i: number): string | undefined {
  const n = p.model.nodes[i]!;
  const v = (k: string, def = 0) => p.num(i, k, def);
  const type: string = n.type;
  if (type === 'path') return (p.value(n.id + '.d') as string) ?? n.d!;
  else if (type === 'ellipse') {
    const cx = v('cx'),
      cy = v('cy'),
      rx = v('rx'),
      ry = v('ry');
    return `M${fmt(cx - rx)} ${fmt(cy)}a${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(2 * rx)} 0a${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(-2 * rx)} 0Z`;
  } else if (type === 'polygon' || type === 'star') {
    const star = type === 'star',
      count = Math.round(v(star ? 'points' : 'sides')) * (star ? 2 : 1);
    return outline(
      Array.from({ length: count }, (_, j): Point => {
        const angle =
          ((star ? -90 : v('rotation') - 90) * Math.PI) / 180 + (j * Math.PI * 2) / count;
        const radius = v(star && j % 2 ? 'innerRadius' : 'radius');
        return [v('cx') + radius * Math.cos(angle), v('cy') + radius * Math.sin(angle)];
      }),
      [v('cornerRadius')],
    );
  } else if (type === 'triangle') {
    const x = v('x0'),
      y = v('y0'),
      w = v('width'),
      h = v('height');
    return `M${fmt(x + w / 2)} ${fmt(y)}L${fmt(x + w)} ${fmt(y + h)}L${fmt(x)} ${fmt(y + h)}Z`;
  }
  return undefined;
}
