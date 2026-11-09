import type { Module } from '../../../packages/core/src/modules.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { Model, NodeM } from '../../../packages/core/src/load.ts';
import type { Shape } from '../../../packages/core/src/registry.ts';
import { apply, IDENTITY, invert, mul, type Mat } from '../../../packages/core/src/geom.ts';
import {
  C,
  L,
  M,
  Z,
  flatten,
  formatSegs,
  parsePath,
  type Subpath,
} from '../../../packages/core/src/path.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { drawFrame, type DrawFrame, type DrawNode } from '../../../packages/core/src/draw.ts';
import { nodePointer } from '../../components/core/node-pointer.ts';
import { compileVertices, type Vertex } from '../../contour/core/index.ts';
import type { RigModule } from '../../rig/core/index.ts';
import { after } from '../manifest.ts';

type Influence = [number, number][];
type Weight = { point: Influence; in?: Influence; out?: Influence };
type SkinData = { bones: number[]; weights?: Weight[]; rest: [number, number][] };
type RawInfluence = Record<string, number>;
type RawWeight = { point: RawInfluence; in?: RawInfluence; out?: RawInfluence };

const number: Shape = { k: 'num', min: 0, max: 1 };
const influences: Shape = { k: 'map', of: number };
const skinShape: Shape = {
  k: 'obj',
  p: {
    bones: { k: 'arr', min: 1, of: { k: 'str' } },
    weights: {
      k: 'arr',
      min: 1,
      of: { k: 'obj', p: { point: influences, in: influences, out: influences }, req: ['point'] },
    },
  },
  req: ['bones'],
};
const data = new WeakMap<object, SkinData>();
const auto = new WeakMap<Player, Map<string, Influence>>();
let rig: RigModule | undefined;

const pathRest = (n: NodeM): [number, number][] => {
  const out: [number, number][] = [];
  for (const sp of n.geom ?? [])
    for (let i = 0; i < sp.segs.length;) {
      const op = sp.segs[i++]!;
      if (op === M || op === L) {
        out.push([sp.segs[i]!, sp.segs[i + 1]!]);
        i += 2;
      } else if (op === C) {
        out.push([sp.segs[i + 4]!, sp.segs[i + 5]!]);
        i += 6;
      }
    }
  return out;
};

const contourRest = (n: NodeM): [number, number][] => {
  const o = n.raw.geometryOrigin ?? [0, 0];
  return (n.raw.vertices as Vertex[]).map((v) => [v.point[0] - o[0], v.point[1] - o[1]]);
};

const meshRest = (n: NodeM): [number, number][] => {
  const r = n.raw,
    m = r.mesh;
  if (!m) return [];
  if (m.vertices) return m.vertices.map((v: number[]) => [v[0], v[1]]);
  const [cols, rows] = m.grid,
    out: [number, number][] = [];
  for (let y = 0; y <= rows; y++)
    for (let x = 0; x <= cols; x++)
      out.push([r.x0 + (r.width * x) / cols, r.y0 + (r.height * y) / rows]);
  return out;
};

function normalize(
  raw: RawInfluence,
  allowed: Map<string, number>,
  pointer: string,
  d: Parameters<NonNullable<Module['prepare']>>[1],
): Influence {
  const pairs = Object.entries(raw);
  if (pairs.length > 4)
    d.err(
      'rig-weight-count',
      pointer,
      V && `weight has ${pairs.length} influences`,
      V && 'use at most four bones including @rest',
    );
  for (const [name] of pairs)
    if (name !== '@rest' && !allowed.has(name))
      d.err(
        'rig-weight-bone',
        pointer + '/' + name.replace(/~/g, '~0').replace(/\//g, '~1'),
        V && `weight references bone ${name} outside skin.bones`,
        V && 'add the bone to skin.bones or remove the influence',
      );
  const sum = pairs.reduce((s, [, w]) => s + w, 0);
  if (Math.abs(sum - 1) > 1e-6)
    d.warn('rig-weight-sum', pointer, V && `weights sum to ${sum}; normalized automatically`);
  if (!(sum > 0)) return [[-1, 1]];
  return pairs.map(([name, w]) => [name === '@rest' ? -1 : (allowed.get(name) ?? -2), w / sum]);
}

const distance = (p: [number, number], a: [number, number], b: [number, number]): number => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    q = dx * dx + dy * dy,
    t = q ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / q)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};

function automatic(
  p: Player,
  node: number,
  key: string,
  point: [number, number],
  s: SkinData,
): Influence {
  let cache = auto.get(p);
  if (!cache) auto.set(p, (cache = new Map()));
  const hit = cache.get(key);
  if (hit) return hit;
  const ctx = rig?.context(p),
    w0 = ctx?.rest(node) ?? p.world(node),
    world = apply(w0, point[0], point[1]),
    nearest = s.bones
      .map((bone) => {
        const b = ctx?.rest(bone) ?? IDENTITY,
          a = apply(b, 0, 0),
          z = apply(b, p.model.nodes[bone]!.raw.length ?? 0, 0);
        return [bone, distance(world, a, z)] as [number, number];
      })
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2),
    values = nearest.map(([bone, d]) => [bone, 1 / (d + 0.001) ** 2] as [number, number]),
    sum = values.reduce((n, [, w]) => n + w, 0),
    result = values.map(([bone, w]) => [bone, w / sum] as [number, number]);
  cache.set(key, result);
  return result;
}

function influence(
  p: Player,
  node: number,
  k: number,
  part: 'point' | 'in' | 'out',
  point: [number, number],
  s: SkinData,
): Influence {
  const w = s.weights?.[k];
  return w ? (w[part] ?? w.point) : automatic(p, node, `${node}:${k}:${part}`, point, s);
}

function deform(p: Player, node: number, point: [number, number], w: Influence): [number, number] {
  const ctx = rig?.context(p),
    w0 = ctx?.rest(node) ?? p.world(node),
    iw0 = invert(w0);
  if (!iw0) return point;
  const q = apply(w0, point[0], point[1]);
  let x = 0,
    y = 0;
  for (const [bone, amount] of w) {
    let v = q;
    if (bone >= 0 && ctx) {
      const inv = invert(ctx.rest(bone));
      if (inv) v = apply(mul(ctx.world(bone), inv), q[0], q[1]);
    }
    x += v[0] * amount;
    y += v[1] * amount;
  }
  return apply(iw0, x, y);
}

function move(
  p: Player,
  node: number,
  k: number,
  part: 'point' | 'in' | 'out',
  point: [number, number],
  s: SkinData,
): [number, number] {
  return deform(p, node, point, influence(p, node, k, part, point, s));
}

function skinPath(p: Player, node: number, s: SkinData): string {
  let k = 0;
  const out: Subpath[] = (p.model.nodes[node]!.geom ?? []).map((sp) => {
    const g = [...sp.segs];
    let previous = -1;
    for (let i = 0; i < g.length;) {
      const op = g[i++]!;
      if (op === Z) continue;
      if (op === M || op === L) {
        const current = k++,
          q = move(p, node, current, 'point', [g[i]!, g[i + 1]!], s);
        [g[i], g[i + 1]] = q;
        i += 2;
        previous = current;
      } else if (op === C) {
        const current = k++,
          a = move(p, node, previous, 'out', [g[i]!, g[i + 1]!], s),
          b = move(p, node, current, 'in', [g[i + 2]!, g[i + 3]!], s),
          q = move(p, node, current, 'point', [g[i + 4]!, g[i + 5]!], s);
        g.splice(i, 6, ...a, ...b, ...q);
        i += 6;
        previous = current;
      }
    }
    return { ...sp, segs: g };
  });
  return formatSegs(out);
}

function handles(v: Vertex): { incoming: [number, number]; outgoing: [number, number] } {
  if (v.kind === 'mirrored') {
    const o = v.handle ?? [0, 0];
    return { incoming: [-o[0], -o[1]], outgoing: o };
  }
  if (v.kind === 'asymmetric') {
    const o = v.outgoing ?? [0, 0],
      a = Math.hypot(...o),
      b = Math.hypot(...(v.incoming ?? [0, 0]));
    return { incoming: a ? [(-o[0] * b) / a, (-o[1] * b) / a] : [0, 0], outgoing: o };
  }
  return {
    incoming: v.kind === 'detached' ? (v.incoming ?? [0, 0]) : [0, 0],
    outgoing: v.kind === 'detached' ? (v.outgoing ?? [0, 0]) : [0, 0],
  };
}

function skinContour(p: Player, node: number, s: SkinData): string {
  const raw = p.model.nodes[node]!.raw,
    o = raw.geometryOrigin ?? [0, 0],
    vertices = (raw.vertices as Vertex[]).map((v, k): Vertex => {
      const point: [number, number] = [v.point[0] - o[0], v.point[1] - o[1]],
        q = move(p, node, k, 'point', point, s);
      if (v.kind === 'straight' || v.kind === 'rounded') return { ...v, point: q };
      const h = handles(v),
        incoming = move(p, node, k, 'in', [point[0] + h.incoming[0], point[1] + h.incoming[1]], s),
        outgoing = move(p, node, k, 'out', [point[0] + h.outgoing[0], point[1] + h.outgoing[1]], s);
      return {
        point: q,
        kind: 'detached',
        incoming: [incoming[0] - q[0], incoming[1] - q[1]],
        outgoing: [outgoing[0] - q[0], outgoing[1] - q[1]],
      };
    });
  return compileVertices(vertices, raw.closed, [0, 0]);
}

function parentWorld(frame: DrawFrame, model: Model, node: number): Mat {
  let m = IDENTITY;
  for (let i = node; i >= 0; i = model.nodes[i]!.parent) m = mul(frame.nodes[i]!.transform, m);
  return m;
}

function geometry(p: Player, node: number): string | undefined {
  const n = p.model.nodes[node]!,
    s = data.get(n.raw);
  if (!s) return;
  const type = String(n.type);
  return type === 'path'
    ? skinPath(p, node, s)
    : type === 'contour'
      ? skinContour(p, node, s)
      : undefined;
}

export const skin: Module = {
  name: 'skin',
  after,
  entries: [{ target: 'node', shapes: { skin: skinShape } }],
  init(registry, shared) {
    rig = registry.get('rig') as RigModule | undefined;
    const values = shared.Player.prototype.values;
    if (!(shared.Player.prototype as unknown as { skinValues?: boolean }).skinValues) {
      (shared.Player.prototype as unknown as { skinValues?: boolean }).skinValues = true;
      shared.Player.prototype.values = function () {
        const out = values.call(this);
        for (const [i, n] of this.model.nodes.entries()) {
          const s = data.get(n.raw);
          if (!s) continue;
          s.rest.forEach((rest, k) => {
            const base =
                String(n.type) === 'image'
                  ? ((this.prop(i, 'mesh.vertex.' + k) as [number, number]) ?? rest)
                  : rest,
              local = move(this, i, k, 'point', base, s),
              worldMatrix = rig?.context(this)?.rest(i) ?? this.world(i),
              world = apply(worldMatrix, local[0], local[1]);
            out[n.id + '.skin.point.' + k] = world;
          });
        }
        return out;
      };
    }
    return { ...this, init: undefined };
  },
  prepare(model, d) {
    if (!model.doc.requires?.includes('skin')) return;
    for (const [i, n] of model.nodes.entries()) {
      const raw = n.raw.skin as { bones: string[]; weights?: RawWeight[] } | undefined;
      if (!raw) continue;
      const at = nodePointer(model, i) + '/skin',
        type = String(n.type),
        host = type === 'path' || type === 'contour' || (type === 'image' && !!n.raw.mesh);
      if (!host)
        d.err(
          'rig-skin-host',
          at,
          V && 'skin requires a path, contour, or meshed image',
          V && 'move skin to supported geometry',
        );
      if (type === 'path' && model.addrs.has(n.id + '.d'))
        d.err(
          'rig-skin-morph',
          at,
          V && 'a skinned path cannot animate d',
          V && 'animate bones or remove skin',
        );
      const allowed = new Map<string, number>();
      raw.bones.forEach((id, k) => {
        const bone = model.ids.get(id);
        if (bone === undefined || String(model.nodes[bone]!.type) !== 'bone')
          d.err(
            'rig-weight-bone',
            `${at}/bones/${k}`,
            V && `${id} is not a bone`,
            V && 'use an existing bone id',
          );
        else allowed.set(id, bone);
      });
      const rest =
        type === 'path' ? pathRest(n) : type === 'contour' ? contourRest(n) : meshRest(n);
      if (raw.weights && raw.weights.length !== rest.length)
        d.err(
          'bad-value',
          at + '/weights',
          V && `skin has ${raw.weights.length} weights for ${rest.length} points`,
          V && 'provide one weight entry per point',
        );
      const weights = raw.weights?.map((w, k) => ({
        point: normalize(w.point, allowed, `${at}/weights/${k}/point`, d),
        ...(w.in ? { in: normalize(w.in, allowed, `${at}/weights/${k}/in`, d) } : {}),
        ...(w.out ? { out: normalize(w.out, allowed, `${at}/weights/${k}/out`, d) } : {}),
      }));
      data.set(n.raw, { bones: [...allowed.values()], weights, rest });
    }
  },
  load(model) {
    if (!model.doc.requires?.includes('skin')) return;
    const previous = model.nesting;
    model.nesting = (p) => {
      const nested = previous?.(p);
      p.hitFrame ??= () => drawFrame(p);
      p.skinPoints = (node, xy) => {
        const s = data.get(p.model.nodes[node]!.raw);
        if (!s) return;
        for (let k = 0; k * 2 < xy.length; k++) {
          const base: [number, number] = [xy[k * 2]!, xy[k * 2 + 1]!],
            q = move(p, node, k, 'point', s.rest[k] ?? base, s);
          xy[k * 2] = q[0];
          xy[k * 2 + 1] = q[1];
        }
      };
      return nested;
    };
  },
  outline(p, i) {
    const d = geometry(p, i);
    if (d !== undefined) return flatten(parsePath(d));
  },
  draw: {
    frame(p, i, node: DrawNode, _entry, frame) {
      const s = data.get(p.model.nodes[i]!.raw);
      if (!s) return;
      const d = geometry(p, i);
      if (d !== undefined) node.geometry = { kind: 'path', d };
      const rest = rig?.context(p)?.rest(i);
      if (!rest) return;
      const parent = p.model.nodes[i]!.parent,
        base = parent < 0 ? IDENTITY : parentWorld(frame, p.model, parent),
        inverse = invert(base);
      if (inverse) node.transform = mul(inverse, rest);
    },
  },
};
