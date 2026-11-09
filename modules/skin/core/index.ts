import type { Module } from '../../../packages/core/src/modules.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { NodeM } from '../../../packages/core/src/load.ts';
import { apply, IDENTITY, invert, mul } from '../../../packages/core/src/geom.ts';
import {
  C,
  L,
  M,
  Z,
  formatSegs,
  parsePath,
  type Subpath,
} from '../../../packages/core/src/path.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { drawFrame, drawWorld, type DrawNode } from '../../../packages/core/src/draw.ts';
import type { RigModule } from '../../rig/core/index.ts';
import { after } from '../manifest.ts';
import { entries, skinElement } from '../capabilities/rigging-skin/registry.ts';

export type Influence = [number, number][];
type Weight = { point: Influence; in?: Influence; out?: Influence };
export type SkinData = {
  bones: number[];
  weights?: Weight[];
  rest: [number, number][];
  at: string;
};
type RawInfluence = Record<string, number>;
type RawWeight = { point: RawInfluence; in?: RawInfluence; out?: RawInfluence };
export type Auto = (
  p: Player,
  node: number,
  key: string,
  point: [number, number],
  s: SkinData,
  rig: RigModule | undefined,
) => Influence;
export type MeshRest = (node: NodeM) => [number, number][];
export type MeshDeform = (
  p: Player,
  node: number,
  xy: number[],
  s: SkinData,
  movePoint: (
    p: Player,
    node: number,
    k: number,
    part: 'point' | 'in' | 'out',
    point: [number, number],
    s: SkinData,
  ) => [number, number],
) => void;
type ContourVertex = { point: [number, number]; kind: string };
type ContourModule = Module & { pathfollowPath(p: Player, node: number): string | undefined };

const data = new WeakMap<object, SkinData>();
let rig: RigModule | undefined;
let contour: ContourModule | undefined;
type Extensions = [Auto?, MeshRest?, MeshDeform?, boolean?];
const extensions: Extensions = [];

export { data };
export const rigContext = (p: Player) => rig?.context(p);

export type SkinModule = Module & {
  x?: Extensions;
};

const pathRest = (n: NodeM): [number, number][] => {
  const out: [number, number][] = [];
  for (const sp of n.geom ?? [])
    for (let i = 0; i < sp.segs.length;) {
      const op = sp.segs[i++]!;
      if (op === C) {
        out.push([sp.segs[i + 4]!, sp.segs[i + 5]!]);
        i += 6;
      } else if (op !== Z) {
        out.push([sp.segs[i]!, sp.segs[i + 1]!]);
        i += 2;
      }
    }
  return out;
};

const contourRest = (n: NodeM): [number, number][] => {
  const o = n.raw.geometryOrigin ?? [0, 0];
  return (n.raw.vertices as ContourVertex[]).map((v) => [v.point[0] - o[0], v.point[1] - o[1]]);
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
  let sum = 0;
  for (const [name, weight] of pairs) {
    sum += weight;
    if (name !== '@rest' && !allowed.has(name))
      d.err(
        'rig-weight-bone',
        pointer + '/' + name.replace(/~/g, '~0').replace(/\//g, '~1'),
        V && `weight references bone ${name} outside skin.bones`,
        V && 'add the bone to skin.bones or remove the influence',
      );
  }
  if (Math.abs(sum - 1) > 1e-6)
    d.err(
      'rig-weight-sum',
      pointer,
      V && `weights sum to ${sum}`,
      V && 'weights are normalized automatically',
      'warning',
    );
  if (!(sum > 0)) return [[-1, 1]];
  return pairs.map(([name, w]) => [name === '@rest' ? -1 : (allowed.get(name) ?? -2), w / sum]);
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
  return w
    ? (w[part] ?? w.point)
    : (extensions[0]?.(p, node, `${node}:${k}:${part}`, point, s, rig) ?? [[-1, 1]]);
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

export function move(
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

function skinContour(p: Player, node: number, s: SkinData): string {
  const raw = p.model.nodes[node]!.raw,
    vertices = raw.vertices as ContourVertex[],
    source = contour?.pathfollowPath(p, node),
    sp = source && parsePath(source)[0];
  if (!sp || !vertices.length) return source ?? '';
  const g = [...sp.segs];
  let pos = 0;
  const transform = (k: number, part: 'point' | 'in' | 'out') => {
    const q = move(p, node, k, part, [g[pos]!, g[pos + 1]!], s);
    g[pos++] = q[0];
    g[pos++] = q[1];
  };
  pos++;
  transform(0, 'point');
  const segment = (from: number, to: number, rounded = false) => {
    const op = g[pos++]!;
    if (op === C) {
      transform(rounded ? to : from, rounded ? 'point' : 'out');
      transform(to, rounded ? 'point' : 'in');
    }
    transform(to, 'point');
  };
  for (let i = 0; i < vertices.length; i++) {
    if (vertices[i]!.kind === 'rounded' && (raw.closed || (i > 0 && i + 1 < vertices.length)))
      segment(i, i, true);
    if (i + 1 < vertices.length) segment(i, i + 1);
    else if (raw.closed) segment(i, 0);
  }
  return formatSegs([{ ...sp, segs: g }]);
}

function geometry(p: Player, node: number): string | undefined {
  const n = p.model.nodes[node]!,
    s = data.get(n.raw);
  if (!s) return;
  const type = n.type as string;
  return type === 'path'
    ? skinPath(p, node, s)
    : type === 'contour'
      ? skinContour(p, node, s)
      : undefined;
}

export const skin: SkinModule = {
  name: 'skin',
  after,
  entries,
  init(registry, _shared) {
    if (V) skin.entries[0]!.elements = { skin: skinElement };
    rig = registry.get('rig') as RigModule | undefined;
    contour = registry.get('contour') as ContourModule | undefined;
    return { ...this, init: undefined, x: extensions };
  },
  prepare(model, d) {
    const paths: string[] = [],
      counts = new Map<number, number>();
    for (const [i, n] of model.nodes.entries()) {
      const index = counts.get(n.parent) ?? 0;
      counts.set(n.parent, index + 1);
      const path = (paths[i] =
        (n.parent < 0 ? '/nodes' : paths[n.parent] + '/children') + '/' + index);
      const raw = n.raw.skin as { bones: string[]; weights?: RawWeight[] } | undefined;
      if (!raw) continue;
      const at = path + '/skin',
        type = n.type as string,
        host = type === 'path' || type === 'contour' || (type === 'image' && !!n.raw.mesh);
      if (!host)
        d.err(
          'rig-skin-host',
          at,
          V && 'skin requires a path, contour, or meshed image',
          V && 'move skin to supported geometry',
        );
      if (!raw.weights && !extensions[0])
        d.err(
          'rig-skin-feature',
          at + '/weights',
          V && 'automatic skin weights need the skin-auto entry',
          V && "import '@anima-format/web/skin-auto' before loading this document",
        );
      if (type === 'image' && n.raw.mesh && !extensions[1])
        d.err(
          'rig-skin-feature',
          at,
          V && 'skinned images need the skin-mesh entry',
          V && "import '@anima-format/web/skin-mesh' before loading this document",
        );
      const percentageDash = [
        n.raw.stroke,
        ...(n.raw.paints ?? []).map((p: { stroke?: unknown }) => p.stroke),
      ].some((stroke: { dash?: unknown[] } | undefined) =>
        stroke?.dash?.some((v) => typeof v === 'string' && v.endsWith('%')),
      );
      if (percentageDash && !extensions[3])
        d.err(
          'rig-skin-feature',
          at,
          V && 'skinned percentage dashes need the skin-dash entry',
          V && "import '@anima-format/web/skin-dash' before loading this document",
        );
      const allowed = new Map<string, number>();
      raw.bones.forEach((id, k) => {
        const bone = model.ids.get(id);
        if (bone === undefined || (model.nodes[bone]!.type as string) !== 'bone')
          d.err(
            'rig-weight-bone',
            `${at}/bones/${k}`,
            V && `${id} is not a bone`,
            V && 'use an existing bone id',
          );
        else allowed.set(id, bone);
      });
      const rest =
        type === 'path'
          ? pathRest(n)
          : type === 'contour'
            ? contourRest(n)
            : (extensions[1]?.(n) ?? []);
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
      data.set(n.raw, { bones: [...allowed.values()], weights, rest, at });
    }
  },
  load(model, _raw, d) {
    for (const n of model.nodes) {
      const s = data.get(n.raw);
      if (s && n.type === 'path' && model.addrs.has(n.id + '.d'))
        d.err(
          'rig-skin-morph',
          s.at,
          V && 'a skinned path cannot animate d',
          V && 'animate bones or remove skin',
        );
    }
    const previous = model.nesting;
    model.nesting = (p) => {
      const nested = previous?.(p);
      p.hitFrame ??= () => drawFrame(p);
      if (extensions[2])
        p.skinPoints = (node, xy) => {
          const s = data.get(p.model.nodes[node]!.raw);
          if (s) extensions[2]!(p, node, xy, s, move);
        };
      return nested;
    };
  },
  draw: {
    frame(p, i, node: DrawNode, _entry, frame) {
      const s = data.get(p.model.nodes[i]!.raw);
      if (!s) return;
      const d = geometry(p, i);
      if (d !== undefined) {
        node.geometry = { kind: 'path', d };
      }
      const rest = rig?.context(p)?.rest(i);
      if (!rest) return;
      const parent = p.model.nodes[i]!.parent,
        base = parent < 0 ? IDENTITY : drawWorld(p, parent, frame),
        inverse = invert(base);
      if (inverse) node.transform = mul(inverse, rest);
    },
  },
};
