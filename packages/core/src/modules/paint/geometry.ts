// Independent geometry constructions; SVG path grammar, no Rive source.
import type { Module, ModuleEntry } from '../../modules.ts';
import type { Shape, Prop } from '../../registry.ts';
import { flatten, parsePath, pathLength } from '../../path.ts';
import { fmt } from '../../draw.ts';
import type { Player } from '../../player.ts';
import { VERBOSE as V } from '../../flags.ts';

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
  {
    target: 'rect',
    shapes: { corners: { k: 'tup', of: [num(0), num(0), num(0), num(0)], min: 4 } },
  },
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

type Point = [number, number];
const pt = (p: Point) => p.map(fmt).join(' ');
/** Cut back at most half each adjacent edge, then round with a quadratic through the vertex. */
function outline(points: Point[], radii: number[]): string {
  const parts = points.map((v, i) => {
    const prev = points[(i + points.length - 1) % points.length]!;
    const next = points[(i + 1) % points.length]!;
    const cut = (q: Point): Point => {
      const len = Math.hypot(q[0] - v[0], q[1] - v[1]);
      const t = len ? Math.min(0.5, radii[i % radii.length]! / len) : 0;
      return [v[0] + (q[0] - v[0]) * t, v[1] + (q[1] - v[1]) * t];
    };
    return { v, a: cut(prev), b: cut(next) };
  });
  return (
    parts.map((q, i) => (i ? 'L' : 'M') + pt(q.a) + 'Q' + pt(q.v) + ' ' + pt(q.b)).join('') + 'Z'
  );
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
    const m = /^corners\.([0-3])$/.exec(key);
    if (n.type === 'rect' && m && n.raw.corners)
      return { prop: { type: 'number', min: 0, feature: 'paint' }, rest: n.raw.corners[+m[1]!] };
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
    if (typeof a !== 'string' || typeof b !== 'string') return;
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
    if (
      !entries.some((e) => e.node && e.target === n.type) &&
      !n.raw.corners &&
      !(n.type === 'path' && p.addrs.includes(n.id + '.d'))
    )
      return;
    return flatten(parsePath(sampledPath(p, i)!));
  },
  draw: {
    tree(model, tree) {
      model.nodes.forEach((n, i) => {
        if (entries.some((e) => e.node && e.target === n.type) || n.raw.corners)
          tree.nodes[i]!.kind = 'path';
      });
    },
    frame(p, i, data) {
      const d = sampledPath(p, i);
      if (d !== undefined) data.geometry = { kind: 'path', d };
      if (p.model.nodes[i]!.raw.stroke?.scale === 'fixed')
        for (const paint of data.paints) if (paint.kind === 'stroke') paint.scale = 'fixed';
    },
  },
};
function sampledPath(p: Player, i: number): string | undefined {
  const a: { d?: string } = {};
  const n = p.model.nodes[i]!,
    r = n.raw;
  const v = (k: string, def = 0) => p.num(i, k, def);
  const type: string = n.type;
  if (type === 'path') a.d = (p.value(n.id + '.d') as string) ?? n.d!;
  else if (type === 'ellipse') {
    const cx = v('cx'),
      cy = v('cy'),
      rx = v('rx'),
      ry = v('ry');
    a.d = `M${fmt(cx - rx)} ${fmt(cy)}a${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(2 * rx)} 0a${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(-2 * rx)} 0Z`;
  } else if (type === 'polygon' || type === 'star') {
    const star = type === 'star',
      count = Math.round(v(star ? 'points' : 'sides')) * (star ? 2 : 1);
    a.d = outline(
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
    a.d = `M${fmt(x + w / 2)} ${fmt(y)}L${fmt(x + w)} ${fmt(y + h)}L${fmt(x)} ${fmt(y + h)}Z`;
  } else if (type === 'rect' && r.corners) {
    const x = r.x0,
      y = r.y0,
      w = v('w'),
      h = v('h');
    a.d = outline(
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ],
      [0, 1, 2, 3].map((j) => v('corners.' + j)),
    );
  }
  return a.d;
}

/** Natural local outline length. Relative dashes are resolved before any backend sees a frame. */
export function outlineLength(g: import('../../draw.ts').Geometry | undefined): number {
  if (!g) return 0;
  if (g.d !== undefined) return pathLength(g.d);
  if (g.kind === 'circle') return 2 * Math.PI * g.r!;
  const w = g.width!,
    h = g.height!,
    r = g.rx ?? 0,
    rx = Math.min(r, w / 2),
    ry = Math.min(r, h / 2);
  return (
    2 * (w + h - 2 * rx - 2 * ry) +
    (rx && ry ? 4 * pathLength(`M${rx} 0A${rx} ${ry} 0 0 1 0 ${ry}`) : 0)
  );
}
