import type { Player } from '../../../packages/core/src/player.ts';

// seam(P8-8): optional painted-order key shared by input and pointer focus.
declare module '../../../packages/core/src/player.ts' {
  interface Player {
    paintRank?: (node: number) => number;
  }
}

import { after } from '../manifest.ts';
// Independent SVG compositing; no Rive algorithms or source.
import { type Module, type ModuleRegistry } from '../../../packages/core/src/modules.ts';
import { type Shape, type Prop, type ObjShape } from '../../../packages/core/src/registry.ts';
import { parseHex } from '../../../packages/core/src/color.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';

const str = (of?: string[]): Shape => ({ k: 'str', of });

const bool: Shape = { k: 'bool' };
const object = (p: Record<string, Shape>, req: string[] = []): ObjShape => ({ k: 'obj', p, req });
const blends =
  'normal multiply screen overlay darken lighten color-dodge color-burn hard-light soft-light difference exclusion hue saturation color luminosity'.split(
    ' ',
  );
const mask = object(
  {
    source: str(),
    mode: str(['alpha', 'luminance', 'inverted-alpha', 'inverted-luminance']),
    sourceDraws: { ...bool, markup: 'source-draws' },
  },
  ['source', 'mode', 'sourceDraws'],
);
const clip = object(
  { source: str(), rule: { ...str(['nonzero', 'evenodd']), default: 'nonzero' } },
  ['source'],
);
const order = object({ target: str(), position: str(['before', 'after']), active: bool }, [
  'target',
  'position',
]);
import { drawPaint, type DrawPaint, type DrawFrame } from '../../../packages/core/src/draw.ts';

let registry: ReadonlyMap<string, Module>;
let shapes: ModuleRegistry;
export const composite: Module = {
  name: 'composite',
  after,
  init: (modules, shared) => {
    registry = modules;
    shapes = shared;
    return { ...composite, init: undefined, entries: compositeEntries() };
  },
  entries: [],
  load(m, _raw, d) {
    if (m.nodes.some((n) => n.raw.drawOrder)) {
      const previous = m.nesting;
      m.nesting = (p) => {
        let revision = -1,
          ranks: number[];
        p.paintRank = (i) => {
          if (revision !== p.drawRevision) {
            ranks = ordered(p);
            revision = p.drawRevision;
          }
          return ranks[i] ?? i;
        };
        return previous?.(p);
      };
    }
    const paths: string[] = [],
      counts = new Map<number, number>();
    const reaches = (from: number, target: number, seen = new Set<number>()): boolean => {
      if (from === target) return true;
      if (seen.has(from)) return false;
      seen.add(from);
      const n = m.nodes[from]!;
      const source = m.ids.get(n.raw.mask?.source);
      return [...n.children, ...(source === undefined ? [] : [source])].some((i) =>
        reaches(i, target, seen),
      );
    };
    m.nodes.forEach((n, i) => {
      const j = counts.get(n.parent) ?? 0;
      counts.set(n.parent, j + 1);
      const path = (paths[i] = (n.parent < 0 ? '/nodes' : paths[n.parent] + '/children') + '/' + j);
      const error = (
        code: string,
        key: string,
        message: string | false,
        hint: string | false = V && 'choose a valid sibling source',
      ) => d.err(code, path + '/' + key, V && message, V && hint);
      for (const key of ['mask', 'clip', 'drawOrder']) {
        const r = n.raw[key];
        if (!r) continue;
        const s = m.ids.get(r.source ?? r.target);
        if (s === undefined) {
          error(
            'unknown-source',
            key + (key === 'drawOrder' ? '/target' : '/source'),
            V && 'unknown source node',
          );
          continue;
        }
        if (key === 'mask' && s !== i && reaches(s, i))
          error(
            'reference-cycle',
            key,
            V && 'mask subtree reference cycle',
            V && 'remove the cyclic reference',
          );
        if (s === i) error('self-reference', key, V && 'a node cannot reference itself');
        if (key === 'clip' && !shapes.PAINTED.includes(m.nodes[s]!.type))
          error(
            'clip-source-not-painted',
            key + '/source',
            V && 'clip source must have an outline',
            V && 'choose a painted node',
          );
        if (
          key === 'drawOrder' &&
          (m.nodes[s]!.parent !== n.parent ||
            m.nodes.some((other) => other.parent === n.parent && other.raw.knockout !== undefined))
        )
          error(
            'bad-draw-target',
            key,
            V && 'draw target must be a sibling without knockout',
            V && 'use ordinary sibling nodes',
          );
        const seen = new Set([i]);
        let at: number | undefined = s;
        while (at !== undefined) {
          if (seen.has(at)) {
            if (s !== i)
              error(
                'reference-cycle',
                key,
                V && 'reference cycle',
                V && 'remove the cyclic reference',
              );
            break;
          }
          seen.add(at);
          const next: { source?: string; target?: string } = m.nodes[at]!.raw[key];
          at = next ? m.ids.get((next.source ?? next.target)!) : undefined;
        }
      }
      if (n.raw.paints && (n.raw.fill || n.raw.stroke))
        error(
          'paint-conflict',
          'paints',
          V && 'paints replaces fill and stroke',
          V && 'remove single fill and stroke',
        );
      n.raw.paints?.forEach((entry: Record<string, unknown>, j: number) => {
        const kind = entry.fill ? 'fill' : 'stroke';
        const raw = entry[kind] as Record<string, unknown>;
        if (raw) {
          const diagnosticStart = d.list.length;
          registry
            .get('paint')
            ?.load?.({ ...m, nodes: [{ ...n, raw: { [kind]: raw }, parent: -1 }] }, _raw, d);
          for (const diagnostic of d.list.slice(diagnosticStart))
            diagnostic.pointer = diagnostic.pointer.replace('/nodes/0/', `${path}/paints/${j}/`);
          const colors = raw.type
            ? ((raw.stops as { color: string }[]) ?? []).map((v) => v.color)
            : [raw.color];
          for (const c of colors)
            if (
              typeof c === 'string' &&
              !parseHex(c) &&
              c !== 'currentColor' &&
              !Object.hasOwn(m.colors, c)
            )
              error(
                'bad-color',
                `paints/${j}/${kind}/color`,
                V && 'unknown paint colour',
                V && 'use a hex colour or declared slot',
              );
          if (kind === 'stroke' && raw.position && raw.position !== 'center')
            error(
              'bad-value',
              `paints/${j}/stroke/position`,
              V && 'multiple paints currently use centered strokes',
              V && 'use stroke.position on a single stroke',
            );
        }
        if (Object.keys(entry).filter((k) => k !== '$comment').length !== 1)
          error(
            'paint-conflict',
            `paints/${j}`,
            V && 'one fill or stroke per paint',
            V && 'split paints into separate entries',
          );
      });
    });
  },
  model(n, key) {
    if (key === 'drawOrder.active' && n.raw.drawOrder)
      return {
        prop: { type: 'bool', def: true, feature: 'composite' },
        rest: n.raw.drawOrder.active ?? true,
      };
    const match = /^paints\.(0|[1-9][0-9]*)\.(fill|stroke)\.(.+)$/.exec(key);
    if (!match) return;
    const raw = n.raw.paints?.[+match[1]!]?.[match[2]!];
    if (!raw) return;
    const field = match[3]!;
    const nested = registry
      .get('paint')
      ?.model?.({ ...n, raw: { [match[2]!]: raw } }, match[2] + '.' + field);
    if (nested) return nested;
    const prop: Prop | undefined =
      field === 'visible'
        ? { type: 'bool', def: true }
        : shapes.PAINT[match[2] as 'fill' | 'stroke'][field];
    if (!prop || (raw[field] === undefined && prop.def === undefined)) return;
    return {
      prop: { ...prop, feature: 'composite' },
      rest: prop.type === 'color' ? (parseHex(raw[field]) ?? raw[field]) : (raw[field] ?? prop.def),
    };
  },
  draw: {
    tree(m, t) {
      const ancestors = (i: number): number[] =>
        i < 0 ? [] : [i, ...ancestors(m.nodes[i]!.parent)];
      for (let i = 0; i < m.nodes.length; i++) t.nodes[i]!.dependencies = ancestors(i);
      m.nodes.forEach((n, i) => {
        const r = n.raw,
          node = t.nodes[i]!;
        node.blend = r.blend;
        node.mask = r.mask ? { ...r.mask, source: m.ids.get(r.mask.source)! } : undefined;
        node.clip = r.clip
          ? {
              rule: clip.p.rule!.default,
              ...r.clip,
              source: m.ids.get(r.clip.source)!,
            }
          : undefined;
        for (const kind of ['mask', 'clip'] as const)
          if (node[kind]) {
            const source = node[kind]!.source;
            t.resources.push({ node: i, kind, source });
            t.nodes[source]!.dependencies!.push(...ancestors(n.parent));
          }
        node.position = r.stroke?.position;
        node.paints = r.paints?.map((entry: Record<string, DrawPaint>) => {
          const kind = entry.fill ? 'fill' : 'stroke',
            p = entry[kind]!;
          const paint = { ...p, kind, visible: true } as DrawPaint;
          if (p.type && String(p.type) !== 'image')
            t.resources.push({
              node: i,
              kind: 'gradient',
              key: `paints.${r.paints.indexOf(entry)}.${kind}`,
              paint,
            });
          return paint;
        });
      });
    },
    frame(p, i, data, entry, frame) {
      const r = p.model.nodes[i]!.raw;
      data.world = p.world(i);
      data.blend = entry.blend;
      data.mask = entry.mask;
      data.clip = entry.clip;
      if ((frame as CompositeFrame).orderRevision !== p.drawRevision) {
        frame.order = ordered(p);
        (frame as CompositeFrame).orderRevision = p.drawRevision;
      }
      for (const paint of data.paints) {
        paint.visible = p.prop(i, paint.kind + '.visible') !== false;
        if (paint.kind === 'stroke') paint.position = r.stroke.position;
      }
      if (r.paints)
        data.paints = r.paints.map((_entry: unknown, index: number) => {
          const kind = r.paints[index].fill ? 'fill' : 'stroke';
          const paint = drawPaint(p, i, kind, `paints.${index}.${kind}`, r.paints[index][kind])!;
          const sample = { ...data, paints: [paint] };
          for (const m of p.model.drawModules!)
            if (m.name !== 'composite') m.draw?.frame?.(p, i, sample, entry, frame);
          paint.visible = p.prop(i, `paints.${index}.${kind}.visible`) !== false;
          return paint;
        });
    },
  },
};
function compositeEntries(): Module['entries'] {
  const { FILL, STROKE } = shapes;
  const form = (shape: Shape, key: string, wrapper?: string) => ({
    shape: shape as ObjShape,
    target: {
      attribute: 'for',
      default: key,
      choices: [key],
      ...(wrapper ? { array: true, wrapper } : {}),
    },
  });
  const elements = {
    mask: form(mask, 'mask'),
    clip: form(clip, 'clip'),
    drawOrder: form(order, 'drawOrder'),
    fillPaint: form(FILL, 'paints', 'fill'),
    strokePaint: form(STROKE, 'paints', 'stroke'),
  };

  return [
    ...['fill', 'stroke'].map((target) => ({
      target,
      shapes: { visible: { k: 'bool' as const, markup: target + '-visible' } },
      props: { visible: { type: 'bool' as const, def: true } },
    })),
    {
      target: 'stroke',
      shapes: {
        position: { ...str(['center', 'inside', 'outside']), markup: 'stroke-position' },
      },
    },
    {
      target: 'node',
      elements,
      shapes: {
        blend: { ...str(blends), markup: 'mix-blend-mode' },
        mask: { ...mask, element: 'mask' },
        clip: { ...clip, element: 'clip' },
        drawOrder: { ...order, element: 'drawOrder', markup: 'draw-order' },
      },
    },
    {
      target: 'painted',
      shapes: {
        paints: { k: 'arr', min: 1, element: 'paints', of: object({ fill: FILL, stroke: STROKE }) },
      },
    },
  ];
}

function ordered(p: Player): number[] {
  const ranks: number[] = [];
  let rank = 0;
  const visit = (children: number[]) => {
    const out = [...children];
    for (const i of children) {
      const r = p.model.nodes[i]!.raw.drawOrder;
      if (!r || p.prop(i, 'drawOrder.active') === false) continue;
      const target = p.model.ids.get(r.target)!;
      out.splice(out.indexOf(i), 1);
      out.splice(out.indexOf(target) + (r.position === 'after' ? 1 : 0), 0, i);
    }
    for (const i of out) {
      ranks[i] = rank++;
      visit(p.model.nodes[i]!.children);
    }
  };
  visit(p.model.draw!.roots);
  return ranks;
}

interface CompositeFrame extends DrawFrame {
  orderRevision?: number;
}
