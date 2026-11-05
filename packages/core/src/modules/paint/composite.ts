// Independent SVG compositing; no Rive algorithms or source.
import type { Player } from '../../player.ts';
import type { Module } from '../../modules.ts';
import { NODE_TYPES, PAINTED, FILL, STROKE, PAINT, type Shape, type Prop } from '../../registry.ts';
import { attrs, fmt, type El, type Paint } from '../../svg.ts';
import { parseHex } from '../../color.ts';
import { parsePath } from '../../path.ts';
import { invert, mul, apply, IDENTITY } from '../../geom.ts';
import { VERBOSE as V } from '../../flags.ts';

const str = (of?: string[]): Shape => ({ k: 'str', of });

const bool: Shape = { k: 'bool' };
const object = (p: Record<string, Shape>, req: string[] = []): Shape => ({ k: 'obj', p, req });
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
const clip = object({ source: str(), rule: str(['nonzero', 'evenodd']) }, ['source', 'rule']);
const order = object({ target: str(), position: str(['before', 'after']), active: bool }, [
  'target',
  'position',
]);
const matrix = (m: number[]) => `matrix(${m.map(fmt).join(' ')})`;
const element = (tag: string, node: number, key: string, kids: El[] = []): El => ({
  tag,
  node,
  key,
  role: 'module:composite',
  kids,
});
const cp = (el: El): El => ({ ...el, kids: el.kids.map(cp) });

const composite: Module = /* @__PURE__ */ (() =>
  ({
    name: 'paint',
    entries: [
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
      ...NODE_TYPES.map((target) => ({
        target,
        elements: Object.fromEntries(
          [
            ['mask', mask],
            ['clip', clip],
            ['drawOrder', order],
            ['fillPaint', FILL],
            ['strokePaint', STROKE],
          ].map(([name, shape]) => {
            const array = String(name).endsWith('Paint');
            const wrapper = name === 'fillPaint' ? 'fill' : 'stroke';
            const key = array ? 'paints' : String(name);
            return [
              name,
              {
                shape,
                target: {
                  attribute: 'for',
                  default: key,
                  choices: [key],
                  ...(array ? { array: true, wrapper } : {}),
                },
              },
            ];
          }),
        ) as NonNullable<import('../../modules.ts').ModuleEntry['elements']>,
        shapes: {
          blend: { ...str(blends), markup: 'mix-blend-mode' },
          mask: { ...mask, element: 'mask' },
          clip: { ...clip, element: 'clip' },
          drawOrder: { ...order, element: 'drawOrder', markup: 'draw-order' },
          ...(PAINTED.includes(target)
            ? {
                paints: {
                  k: 'arr' as const,
                  min: 1,
                  element: 'paints',
                  of: object({ fill: FILL, stroke: STROKE }),
                },
              }
            : {}),
        },
      })),
    ],
    load(m, _raw, d) {
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
        const path = (paths[i] =
          (n.parent < 0 ? '/nodes' : paths[n.parent] + '/children') + '/' + j);
        const error = (
          code: string,
          key: string,
          message: string,
          hint = 'choose a valid sibling source',
        ) => d.err(code, path + '/' + key, V && message, V && hint);
        for (const key of ['mask', 'clip', 'drawOrder']) {
          const r = n.raw[key];
          if (!r) continue;
          const s = m.ids.get(r.source ?? r.target);
          if (s === undefined) {
            error(
              'unknown-source',
              key + (key === 'drawOrder' ? '/target' : '/source'),
              'unknown source node',
            );
            continue;
          }
          if (key === 'mask' && s !== i && reaches(s, i))
            error(
              'reference-cycle',
              key,
              'mask subtree reference cycle',
              'remove the cyclic reference',
            );
          if (s === i) error('self-reference', key, 'a node cannot reference itself');
          if (key === 'clip' && !PAINTED.includes(m.nodes[s]!.type))
            error(
              'clip-source-not-painted',
              key + '/source',
              'clip source must have an outline',
              'choose a painted node',
            );
          if (
            key === 'drawOrder' &&
            (m.nodes[s]!.parent !== n.parent ||
              m.nodes.some(
                (other) => other.parent === n.parent && other.raw.knockout !== undefined,
              ))
          )
            error(
              'bad-draw-target',
              key,
              'draw target must be a sibling without knockout',
              'use ordinary sibling nodes',
            );
          const seen = new Set([i]);
          let at: number | undefined = s;
          while (at !== undefined) {
            if (seen.has(at)) {
              if (s !== i)
                error('reference-cycle', key, 'reference cycle', 'remove the cyclic reference');
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
            'paints replaces fill and stroke',
            'remove single fill and stroke',
          );
        n.raw.paints?.forEach((entry: Record<string, unknown>, j: number) => {
          const kind = entry.fill ? 'fill' : 'stroke';
          const raw = entry[kind] as Record<string, unknown>;
          if (raw) {
            const diagnosticStart = d.list.length;
            base.load?.({ ...m, nodes: [{ ...n, raw: { [kind]: raw }, parent: -1 }] }, _raw, d);
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
                  'unknown paint colour',
                  'use a hex colour or declared slot',
                );
            if (kind === 'stroke' && raw.position && raw.position !== 'center')
              error(
                'bad-value',
                `paints/${j}/stroke/position`,
                'multiple paints currently use centered strokes',
                'use stroke.position on a single stroke',
              );
          }
          if (Object.keys(entry).filter((k) => k !== '$comment').length !== 1)
            error(
              'paint-conflict',
              `paints/${j}`,
              'one fill or stroke per paint',
              'split paints into separate entries',
            );
        });
      });
    },
    model(n, key) {
      if (key === 'drawOrder.active' && n.raw.drawOrder)
        return {
          prop: { type: 'bool', def: true, feature: 'paint' },
          rest: n.raw.drawOrder.active ?? true,
        };
      const match = /^paints\.(0|[1-9][0-9]*)\.(fill|stroke)\.(.+)$/.exec(key);
      if (!match) return;
      const raw = n.raw.paints?.[+match[1]!]?.[match[2]!];
      if (!raw) return;
      const field = match[3]!;
      const nested = base.model?.({ ...n, raw: { [match[2]!]: raw } }, match[2] + '.' + field);
      if (nested) return nested;
      const prop: Prop | undefined =
        field === 'visible'
          ? { type: 'bool', def: true }
          : PAINT[match[2] as 'fill' | 'stroke'][field];
      if (!prop || (raw[field] === undefined && prop.def === undefined)) return;
      return {
        prop: { ...prop, feature: 'paint' },
        rest:
          prop.type === 'color' ? (parseHex(raw[field]) ?? raw[field]) : (raw[field] ?? prop.def),
      };
    },
    scene(m, tree) {
      const originals = new Map<number, El>();
      const collect = (els: El[]) =>
        els.forEach((el) => {
          if (el.role === 'node') originals.set(el.node, cp(el));
          collect(el.kids);
        });
      collect(tree.root);
      const sources = new Set<number>();
      const process = (els: El[]) => {
        for (let j = 0; j < els.length; j++) {
          const el = els[j]!;
          if (el.role !== 'node') {
            process(el.kids);
            continue;
          }
          process(el.kids);
          const r = m.nodes[el.node]!.raw;
          if (r.paints) {
            r.paints.forEach((entry: object, index: number) => {
              const defs: El[] = [];
              base.scene?.(
                { ...m, nodes: [{ ...m.nodes[el.node]!, raw: entry }] },
                { root: [], defs },
              );
              const mark = (v: El): El => ({
                ...v,
                node: el.node,
                role: 'module:composite',
                key: `gradient:${index}:${v.key}`,
                kids: v.kids.map(mark),
              });
              tree.defs.push(...defs.map(mark));
            });
            el.kids = r.paints.map((_v: unknown, index: number) => ({
              ...el.kids[0]!,
              role: 'module:composite',
              key: 'paint',
              index,
            }));
          }
          for (const key of ['mask', 'clip'])
            if (r[key]) {
              const source = m.ids.get(r[key].source)!;
              if (key === 'mask' && !sources.has(source)) {
                sources.add(source);
                const drawing = [cp(originals.get(source)!)];
                process(drawing);
                tree.defs.push(element('g', source, 'source', drawing));
              }
              const relative = element('g', source, `relative:${el.node}`, [
                element('use', source, 'use'),
              ]);

              if (key === 'mask' && r.mask.mode.startsWith('inverted-'))
                tree.defs.push(
                  element('filter', el.node, 'invert', [
                    ...(r.mask.mode.endsWith('luminance')
                      ? [element('feColorMatrix', el.node, 'luminance')]
                      : []),
                    element('feComponentTransfer', el.node, 'transfer', [
                      element('feFuncA', el.node, 'invert-alpha'),
                    ]),
                  ]),
                );
              if (key === 'mask' && r.mask.mode.startsWith('inverted-'))
                relative.key = `inverted:${el.node}`;
              tree.defs.push(
                element(
                  key === 'mask' ? 'mask' : 'clipPath',
                  el.node,
                  key,
                  key === 'clip'
                    ? [element('path', source, `clip-outline:${el.node}`)]
                    : [relative],
                ),
              );
              els[j] = element('g', el.node, key + '-wrap', [els[j]!]);
            }
          if (r.stroke?.position && r.stroke.position !== 'center') {
            const outside = r.stroke.position === 'outside';
            tree.defs.push(
              element(outside ? 'mask' : 'clipPath', el.node, 'position', [
                ...(outside ? [element('rect', el.node, 'white')] : []),
                {
                  ...cp(originals.get(el.node)!.kids[0]!),
                  role: 'module:composite',
                  key: outside ? 'black' : 'outline',
                },
              ]),
            );
            const shape = el.kids[0]!;
            el.kids = [
              { ...cp(shape), role: 'module:composite', key: 'fill-only' },
              element('g', el.node, 'position-wrap', [
                { ...shape, role: 'module:composite', key: 'stroke-only' },
              ]),
            ];
          }
        }
      };
      process(tree.root);
      const definitions = new Set<string>();
      tree.defs = tree.defs.filter((el) => {
        const key = `${el.node}:${el.key}:${el.role}`;
        if (definitions.has(key)) return false;
        definitions.add(key);
        return true;
      });
      // Hide the source's own drawing only; retained copies remain visible in mask definitions.
      const hidden = new Set(
        m.nodes.flatMap((n) =>
          n.raw.mask?.sourceDraws === false ? [m.ids.get(n.raw.mask.source)!] : [],
        ),
      );
      const hide = (els: El[]) =>
        els.forEach((el) => {
          if (el.role === 'node' && hidden.has(el.node)) el.key = 'hidden';
          hide(el.kids);
        });
      hide(tree.root);
    },
    order(p, nodes) {
      const out = [...nodes];
      for (const i of nodes) {
        const r = p.model.nodes[i]!.raw.drawOrder;
        if (!r || p.prop(i, 'drawOrder.active') === false) continue;
        const target = p.model.ids.get(r.target)!;
        if (!out.includes(target)) continue;
        out.splice(out.indexOf(i), 1);
        out.splice(out.indexOf(target) + (r.position === 'after' ? 1 : 0), 0, i);
      }
      return out;
    },
    attrs(p, el, paint, id, a) {
      const i = el.node,
        r = p.model.nodes[i]!.raw;
      const ref = (key: string) => `url(#${id}c${i}-${key})`;
      if (el.role === 'node') {
        if (r.blend) a.style = `mix-blend-mode:${r.blend}`;
        if (el.key === 'hidden') a.display = 'none';
      }
      if (el.role === 'shape')
        for (const kind of ['fill', 'stroke'])
          if (p.prop(i, kind + '.visible') === false) a[kind] = 'none';
      if (el.role !== 'module:composite') return;
      const key = el.key!;
      if (key === 'source') {
        a.id = `${id}c${i}-source`;
        return;
      }
      if (key === 'use') {
        a.href = `#${id}c${i}-source`;
        return;
      }
      if (key.startsWith('gradient:')) {
        const [, index, kind] = key.split(':');
        base.attrs?.(
          virtual(p, i, +index!),
          { ...el, role: 'module:paint', key: kind },
          paint,
          `${id}m${index}-`,
          a,
        );
        return;
      }
      if (key.endsWith('-wrap')) {
        a['data-anima-wrap'] = 'true';
        a[
          key === 'mask-wrap' || (key === 'position-wrap' && r.stroke.position === 'outside')
            ? 'mask'
            : 'clip-path'
        ] = ref(key.slice(0, -5));
        return;
      }
      const [x, y, w, h] = p.model.viewBox;
      const box = { x: fmt(x - w), y: fmt(y - h), width: fmt(w * 3), height: fmt(h * 3) };
      if (key === 'mask' || key === 'clip' || key === 'position') {
        a.id = `${id}c${i}-${key}`;
        if (el.tag === 'mask')
          Object.assign(a, box, {
            maskUnits: 'userSpaceOnUse',
            'mask-type':
              key === 'mask' &&
              (r.mask.mode.endsWith('alpha') || r.mask.mode.startsWith('inverted-'))
                ? 'alpha'
                : 'luminance',
          });
        return;
      }
      if (key.startsWith('clip-outline:')) {
        const target = +key.split(':')[1]!;
        const parent = p.model.nodes[target]!.parent;
        const inv = invert(parent < 0 ? IDENTITY : p.world(parent));
        const geom = shapeAttrs(p, el, paint, id);
        let d = geom.d;
        if (!d && geom.r) {
          const x = +geom.cx!,
            y = +geom.cy!,
            r = +geom.r;
          d = `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
        }
        if (!d) {
          const x = +geom.x!,
            y = +geom.y!,
            w = +geom.width!,
            h = +geom.height!,
            r = Math.min(+(geom.rx ?? 0), w / 2, h / 2);
          d = `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-w + 2 * r}a${r} ${r} 0 0 1 ${-r} ${-r}v${-h + 2 * r}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
        }
        const transform = inv ? mul(inv, p.world(i)) : IDENTITY;
        a.d = inv
          ? parsePath(d)
              .map((path) => {
                let out = '';
                for (let j = 0; j < path.segs.length;) {
                  const op = path.segs[j++]!;
                  out += ['M', 'L', 'C', 'Z'][op];
                  for (let k = 0; k < (op === 2 ? 3 : op === 3 ? 0 : 1); k++) {
                    const pt = apply(transform, path.segs[j++]!, path.segs[j++]!);
                    out += pt.map(fmt).join(' ') + ' ';
                  }
                }
                return out;
              })
              .join('')
          : '';
        a['clip-rule'] = p.model.nodes[target]!.raw.clip.rule;
        return;
      }
      if (key === 'invert') {
        Object.assign(a, box, {
          id: `${id}c${i}-invert`,
          filterUnits: 'userSpaceOnUse',
          'color-interpolation-filters': 'sRGB',
        });
        return;
      }
      if (key === 'luminance') {
        a.type = 'luminanceToAlpha';
        return;
      }
      if (key === 'transfer') return;
      if (key === 'invert-alpha') {
        Object.assign(a, { type: 'table', tableValues: '1 0' });
        return;
      }
      if (key.startsWith('relative:') || key.startsWith('inverted:')) {
        const target = +key.split(':')[1]!;
        if (key.startsWith('inverted:')) a.filter = `url(#${id}c${target}-invert)`;
        const parent = p.model.nodes[target]!.parent,
          sourceParent = p.model.nodes[i]!.parent;
        const inv = invert(parent < 0 ? IDENTITY : p.world(parent));
        a.transform = matrix(
          inv ? mul(inv, sourceParent < 0 ? IDENTITY : p.world(sourceParent)) : IDENTITY,
        );
        a.opacity = '1';
        a.display = inv ? 'inline' : 'none';
        return;
      }
      if (key === 'white') {
        Object.assign(a, box, { fill: '#fff' });
        return;
      }
      Object.assign(a, shapeAttrs(p, el, paint, id));
      if (['outline', 'black'].includes(key)) {
        a.fill = key === 'black' ? '#000' : '#fff';
        a.stroke = 'none';
        a['clip-rule'] =
          el.index === undefined
            ? (r.fill?.rule ?? 'nonzero')
            : p.model.nodes[el.index]!.raw.clip.rule;
        return;
      }
      if (key === 'fill-only') {
        a.stroke = 'none';
        return;
      }
      if (key === 'stroke-only') {
        a.fill = 'none';
        a['stroke-width'] = fmt(2 * p.num(i, 'stroke.width', 1));
        return;
      }
      if (key === 'paint') {
        const entry = r.paints[el.index!],
          kind = entry.fill ? 'fill' : 'stroke';
        const prefix = `paints.${el.index}.${kind}`;
        const v = virtual(p, i, el.index!);
        Object.assign(a, shapeAttrs(v, el, paint, `${id}m${el.index}-`));
        a.display = p.prop(i, prefix + '.visible') === false ? 'none' : 'inline';
      }
    },
  }) as Module)();

let base: Module;
function shapeAttrs(p: Player, el: El, paint: Paint, id: string) {
  const shape = { ...el, role: 'shape' };
  const a = attrs(p, shape, paint, id);
  base.attrs?.(p, shape, paint, id, a);
  return a;
}
function virtual(p: Player, i: number, index: number): Player {
  const entry = p.model.nodes[i]!.raw.paints[index];
  const v = Object.create(p) as Player;
  Object.defineProperty(v, 'model', {
    value: {
      ...p.model,
      nodes: p.model.nodes.map((n, j) =>
        j === i ? { ...n, raw: { ...n.raw, fill: undefined, stroke: undefined, ...entry } } : n,
      ),
    },
  });
  v.prop = (node, key) =>
    p.prop(node, node === i && /^(fill|stroke)\./.test(key) ? `paints.${index}.${key}` : key);
  v.num = (node, key, def) => {
    const value = v.prop(node, key);
    return typeof value === 'number' ? value : def;
  };
  return v;
}
export function withComposite(module: Module): Module {
  base = module;
  for (const entry of [...module.entries, ...composite.entries])
    if (entry.target === 'fill' || entry.target === 'stroke') {
      const shape = entry.target === 'fill' ? FILL : STROKE;
      if (shape.k === 'obj') {
        Object.assign(shape.p, entry.shapes);
        shape.req = [];
      }
    }
  return {
    ...module,
    crossNode: true,
    entries: [...module.entries, ...composite.entries],
    load(m, r, d) {
      module.load?.(m, r, d);
      composite.load?.(m, r, d);
    },
    model(n, k) {
      return module.model?.(n, k) ?? composite.model?.(n, k);
    },
    scene(m, t) {
      module.scene?.(m, t);
      composite.scene?.(m, t);
    },
    attrs(p, e, c, id, a) {
      module.attrs?.(p, e, c, id, a);
      composite.attrs?.(p, e, c, id, a);
    },
    order: composite.order,
  };
}
