import { fmt } from '../../../packages/core/src/draw.ts';
import { type SVGBackend, type El } from '../../../packages/core/src/svg.ts';
const el = (tag: string, node: number, key: string, kids: El[] = [], index?: number): El => ({
  tag,
  node,
  key,
  kids,
  index,
  role: 'module:surface',
});
const copy = (e: El): El => ({ ...e, kids: e.kids.map(copy) });
const token = (key: string) => key.replaceAll('.', '-');
export class UnsupportedRenderError extends Error {
  readonly code = 'unsupported-render';
  readonly hint =
    'use feather.space local; world-space feathering is deferred to the canvas backend';
  readonly pointer: string;
  constructor(pointer: string) {
    super('SVG cannot faithfully render world-space feathering');
    this.pointer = pointer;
  }
}
export const surfaceSVG: SVGBackend = {
  tree(draw, tree) {
    const existingDefinitions = [...tree.defs],
      slices = new Set<number>();
    for (const r of draw.resources)
      if (r.kind === 'surface') {
        const p = r.paint!,
          key = r.key!;
        if (p.image) {
          tree.defs.push(
            el('pattern', r.node, 'pattern:' + key, [el('image', r.node, 'image:' + key)]),
          );
          if (p.image.modulate)
            tree.defs.push(
              el('filter', r.node, 'tint:' + key, [el('feColorMatrix', r.node, 'matrix:' + key)]),
            );
        }
        if (p.feather)
          tree.defs.push(
            el('filter', r.node, 'feather:' + key, [
              el('feOffset', r.node, 'offset:' + key),
              el('feGaussianBlur', r.node, 'inner:' + key),
              el('feComposite', r.node, 'inside:' + key),
              el('feGaussianBlur', r.node, 'outer:' + key),
              el('feComposite', r.node, 'outside:' + key),
              el('feComposite', r.node, 'sum:' + key),
            ]),
          );
      }
    const process = (list: El[]) => {
      for (let j = 0; j < list.length; j++) {
        const e = list[j]!;
        process(e.kids);
        // Ordered paints are expanded per entry by composite, in either module load order.
        if (
          e.role === 'shape' &&
          !draw.nodes[e.node]!.paints &&
          draw.resources.some((r) => r.node === e.node && r.kind === 'surface')
        ) {
          // Resolve fill and stroke independently so feathering never blurs the other paint.
          list[j] = el(
            'g',
            e.node,
            'leaves',
            ['fill', 'stroke'].map((k) => el(e.tag, e.node, 'leaf:' + k)),
          );
        }
        const s = draw.nodes[e.node]!.slice;
        if (e.role !== 'node' || !s) continue;
        const fresh = !slices.has(e.node);
        if (fresh) tree.defs.push(el('g', e.node, 'source', e.kids.map(copy)));
        const count = (s.x.length - 1) * (s.y.length - 1);
        e.kids = Array.from({ length: count }, (_, index) =>
          el('rect', e.node, 'patch', [], index),
        );
        if (!fresh) continue;
        slices.add(e.node);
        for (let index = 0; index < count; index++)
          tree.defs.push(
            el(
              'pattern',
              e.node,
              'patch-pattern',
              [el('svg', e.node, 'patch-box', [el('use', e.node, 'patch-use', [], index)], index)],
              index,
            ),
          );
      }
    };
    process(existingDefinitions);
    process(tree.root);
  },
  attrs(f, e, paint, id, a, render) {
    const node = f.nodes[e.node]!;
    for (const p of node.paints)
      if (p.feather?.space === 'world' && p.feather.enabled) {
        const resource = f.tree.resources.find(
          (r) => r.kind === 'surface' && r.node === e.node && r.key === (p.key ?? p.kind),
        );
        throw new UnsupportedRenderError(
          (resource?.pointer ?? '/nodes/' + e.node) + '/feather/space',
        );
      }
    if (e.role === 'module:composite' && ['paint', 'fill-only', 'stroke-only'].includes(e.key!)) {
      const selected =
        e.key === 'paint'
          ? node.paints[e.index!]
          : node.paints.find((p) => p.kind === (e.key === 'fill-only' ? 'fill' : 'stroke'));
      if (selected?.image)
        a[selected.kind] = `url(#${id}s${e.node}-pattern-${token(selected.key ?? selected.kind)})`;
      if (selected?.feather)
        a.filter = selected.feather.enabled
          ? `url(#${id}s${e.node}-feather-${token(selected.key ?? selected.kind)})`
          : 'none';
    }
    if (e.role === 'shape') {
      // Composite renders an ordered entry with an `m<index>-` id; surface definitions have none.
      const base = id.replace(/m\d+-$/, '');
      for (const p of node.paints)
        if (p.image && a[p.kind] !== 'none')
          a[p.kind] = `url(#${base}s${e.node}-pattern-${token(p.key ?? p.kind)})`;
    }
    if (e.role !== 'module:surface') return;
    const [kind, ...rest] = e.key!.split(':'),
      key = rest.join(':'),
      suffix = token(key);
    const ident = (name: string) => `${id}s${e.node}-${name}${key ? '-' + suffix : ''}`;
    const ref = (name: string) => `url(#${ident(name)})`;
    const p = node.paints.find((p) => (p.key ?? p.kind) === key);
    if (kind === 'leaves') return;
    if (kind === 'leaf') {
      const selected = node.paints.filter((p) => p.kind === key);
      if (!selected.length) {
        a.display = 'none';
        return;
      }
      const nodes = [...f.nodes];
      nodes[e.node] = { ...node, paints: selected };
      Object.assign(a, render({ ...f, nodes }, { ...e, role: 'shape' }, paint, id));
      const q = selected[0]!;
      if (q.feather)
        a.filter = q.feather.enabled
          ? `url(#${id}s${e.node}-feather-${token(q.key ?? q.kind)})`
          : 'none';
      return;
    }
    if (['pattern', 'image', 'tint', 'matrix'].includes(kind!)) {
      const r = p!.image!;
      if (kind === 'pattern')
        Object.assign(a, {
          id: ident('pattern'),
          patternUnits: 'userSpaceOnUse',
          width: fmt(r.width),
          height: fmt(r.height),
          patternTransform: `translate(${fmt(r.x)} ${fmt(r.y)}) rotate(${fmt(r.rotate)}) scale(${fmt(r.scaleX)} ${fmt(r.scaleY)})`,
        });
      if (kind === 'image')
        Object.assign(a, {
          href: r.source,
          width: fmt(r.width),
          height: fmt(r.height),
          preserveAspectRatio: 'none',
          ...(r.modulate ? { filter: ref('tint') } : {}),
        });
      if (kind === 'tint')
        Object.assign(a, { id: ident('tint'), 'color-interpolation-filters': 'sRGB' });
      if (kind === 'matrix') {
        const c = r.modulate!;
        a.type = 'matrix';
        a.values = [c[0], 0, 0, 0, 0, 0, c[1], 0, 0, 0, 0, 0, c[2], 0, 0, 0, 0, 0, c[3], 0].join(
          ' ',
        );
      }
      return;
    }
    if (p?.feather) {
      const r = p.feather;
      if (kind === 'feather') {
        const [x, y, w, h] = f.viewBox,
          pad = 3 * Math.max(r.inner, r.outer) + Math.max(...r.offset.map(Math.abs));
        Object.assign(a, {
          id: ident('feather'),
          filterUnits: 'userSpaceOnUse',
          x: fmt(x - pad),
          y: fmt(y - pad),
          width: fmt(w + 2 * pad),
          height: fmt(h + 2 * pad),
          'color-interpolation-filters': 'sRGB',
        });
      }
      if (kind === 'offset')
        Object.assign(a, {
          in: 'SourceGraphic',
          dx: fmt(r.offset[0]),
          dy: fmt(r.offset[1]),
          result: 'shifted',
        });
      if (kind === 'inner' || kind === 'outer')
        Object.assign(a, { in: 'shifted', stdDeviation: fmt(r[kind] / 3), result: kind });
      if (kind === 'inside' || kind === 'outside')
        Object.assign(a, {
          in: kind === 'inside' ? 'inner' : 'outer',
          in2: 'SourceAlpha',
          operator: kind === 'inside' ? 'in' : 'out',
          result: kind,
        });
      if (kind === 'sum')
        Object.assign(a, {
          in: 'inside',
          in2: 'outside',
          operator: 'arithmetic',
          k2: '1',
          k3: '1',
        });
      return;
    }
    if (kind === 'source') {
      a.id = ident('source');
      return;
    }
    if (kind?.startsWith('patch')) {
      const patch = node.patches![e.index!]!,
        [sx, sy, sw, sh] = patch.source,
        [x, y, w, h] = patch.target;
      const repeat = patch.mode === 'repeat',
        tw = repeat ? sw! : w!,
        th = repeat ? sh! : h!;
      if (kind === 'patch')
        Object.assign(a, {
          x: fmt(x!),
          y: fmt(y!),
          width: fmt(w!),
          height: fmt(h!),
          fill: `url(#${id}s${e.node}-patch-${e.index})`,
          display: patch.mode === 'hidden' ? 'none' : 'inline',
        });
      if (kind === 'patch-pattern')
        Object.assign(a, {
          id: `${id}s${e.node}-patch-${e.index}`,
          patternUnits: 'userSpaceOnUse',
          x: fmt(x!),
          y: fmt(y!),
          width: fmt(Math.max(tw, 1e-9)),
          height: fmt(Math.max(th, 1e-9)),
        });
      if (kind === 'patch-box')
        Object.assign(a, {
          width: fmt(tw),
          height: fmt(th),
          viewBox: [sx, sy, sw, sh].map((v) => fmt(v!)).join(' '),
          preserveAspectRatio: 'none',
          overflow: 'hidden',
        });
      if (kind === 'patch-use') a.href = `#${id}s${e.node}-source`;
    }
  },
};
