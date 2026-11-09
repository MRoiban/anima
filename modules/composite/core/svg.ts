// SVG-only compositing. Receives resolved draw data, never a Player or raw document.
import { type DrawFrame, fmt } from '../../../packages/core/src/draw.ts';
import {
  type SVGBackend,
  type SVGRenderer,
  type El,
  type Paint,
  type Attrs,
} from '../../../packages/core/src/svg.ts';
import { IDENTITY, invert, mul, apply } from '../../../packages/core/src/geom.ts';
import { parsePath } from '../../../packages/core/src/path.ts';
const matrix = (m: number[]) => `matrix(${m.map(fmt).join(' ')})`;
const element = (tag: string, node: number, key: string, kids: El[] = []): El => ({
  tag,
  node,
  key,
  role: 'module:composite',
  kids,
});
const cp = (el: El): El => ({ ...el, kids: el.kids.map(cp) });

export const compositeSVG: SVGBackend = {
  tree(m, tree) {
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
        const r = m.nodes[el.node]!;
        if (r.paints) {
          el.kids = r.paints.map((_v: unknown, index: number) => ({
            ...el.kids[0]!,
            role: 'module:composite',
            key: 'paint',
            index,
          }));
        }
        for (const key of ['mask', 'clip'] as const)
          if (r[key]) {
            const source = r[key].source;
            if (key === 'mask' && !sources.has(source)) {
              sources.add(source);
              const drawing = [cp(originals.get(source)!)];
              process(drawing);
              tree.defs.push(element('g', source, 'source', drawing));
            }
            const relative = element('g', source, `relative:${el.node}`, [
              element('use', source, 'use'),
            ]);

            if (key === 'mask' && r.mask!.mode.startsWith('inverted-'))
              tree.defs.push(
                element('filter', el.node, 'invert', [
                  ...(r.mask!.mode.endsWith('luminance')
                    ? [
                        element('feColorMatrix', el.node, 'luminance'),
                        element('feComposite', el.node, 'coverage'),
                      ]
                    : []),
                  element('feComponentTransfer', el.node, 'transfer', [
                    element('feFuncA', el.node, 'invert-alpha'),
                  ]),
                ]),
              );
            if (key === 'mask' && r.mask!.mode.startsWith('inverted-'))
              relative.key = `inverted:${el.node}`;
            tree.defs.push(
              element(
                key === 'mask' ? 'mask' : 'clipPath',
                el.node,
                key,
                key === 'clip' ? [element('path', source, `clip-outline:${el.node}`)] : [relative],
              ),
            );
            els[j] = element('g', el.node, key + '-wrap', [els[j]!]);
          }
        if (r.position && r.position !== 'center') {
          const outside = r.position === 'outside';
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
      m.nodes.flatMap((n) => (n.mask?.sourceDraws === false ? [n.mask.source] : [])),
    );
    const hide = (els: El[]) =>
      els.forEach((el) => {
        if (el.role === 'node' && hidden.has(el.node)) el.key = 'hidden';
        hide(el.kids);
      });
    hide(tree.root);
  },
  attrs(p, el, paint, id, a, render) {
    const i = el.node,
      r = p.nodes[i]!;
    const ref = (key: string) => `url(#${id}c${i}-${key})`;
    if (el.role === 'node') {
      if (r.blend) a.style = `mix-blend-mode:${r.blend}`;
      if (el.key === 'hidden') a.display = 'none';
    }
    if (el.role === 'shape')
      for (const kind of ['fill', 'stroke'])
        if (r.paints.find((p) => p.kind === kind)?.visible === false) a[kind] = 'none';
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
    if (key.endsWith('-wrap')) {
      a['data-anima-wrap'] = 'true';
      a[
        key === 'mask-wrap' ||
        (key === 'position-wrap' &&
          r.paints.find((p) => p.kind === 'stroke')?.position === 'outside')
          ? 'mask'
          : 'clip-path'
      ] = ref(key.slice(0, -5));
      return;
    }
    const [x, y, w, h] = p.viewBox;
    const box = { x: fmt(x - w), y: fmt(y - h), width: fmt(w * 3), height: fmt(h * 3) };
    if (key === 'mask' || key === 'clip' || key === 'position') {
      a.id = `${id}c${i}-${key}`;
      if (el.tag === 'mask')
        Object.assign(a, box, {
          maskUnits: 'userSpaceOnUse',
          'mask-type':
            key === 'mask' &&
            (r.mask!.mode.endsWith('alpha') || r.mask!.mode.startsWith('inverted-'))
              ? 'alpha'
              : 'luminance',
        });
      return;
    }
    if (key.startsWith('clip-outline:')) {
      const target = +key.split(':')[1]!;
      const parent = p.tree.nodes[target]!.parent;
      const inv = invert(parent < 0 ? IDENTITY : p.nodes[parent]!.world!);
      const geom = shapeAttrs(render, p, el, paint, id);
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
          // Clamp each axis independently, as the SVG rect source does.
          r = Math.min(+(geom.rx ?? 0), w / 2),
          q = Math.min(+(geom.rx ?? 0), h / 2);
        d = `M${x + r} ${y}h${w - 2 * r}a${r} ${q} 0 0 1 ${r} ${q}v${h - 2 * q}a${r} ${q} 0 0 1 ${-r} ${q}h${-w + 2 * r}a${r} ${q} 0 0 1 ${-r} ${-q}v${-h + 2 * q}a${r} ${q} 0 0 1 ${r} ${-q}Z`;
      }
      const transform = inv ? mul(inv, p.nodes[i]!.world!) : IDENTITY;
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
      a['clip-rule'] = p.nodes[target]!.clip!.rule;
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
    if (key === 'coverage') {
      // luminanceToAlpha discards input alpha; restore opacity and edge coverage.
      Object.assign(a, { operator: 'in', in2: 'SourceGraphic' });
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
      const parent = p.tree.nodes[target]!.parent,
        sourceParent = p.tree.nodes[i]!.parent;
      const inv = invert(parent < 0 ? IDENTITY : p.nodes[parent]!.world!);
      a.transform = matrix(
        inv ? mul(inv, sourceParent < 0 ? IDENTITY : p.nodes[sourceParent]!.world!) : IDENTITY,
      );
      a.opacity = '1';
      a.display = inv ? 'inline' : 'none';
      return;
    }
    if (key === 'white') {
      Object.assign(a, box, { fill: '#fff' });
      return;
    }
    if (key === 'paint') {
      // Only the selected paint: aggregate attributes would leak another entry's stroke.
      const selected = r.paints[el.index!]!;
      Object.assign(a, shapeAttrs(render, p, el, paint, `${id}m${el.index}-`, [selected]));
      a.display = selected.visible ? 'inline' : 'none';
      return;
    }
    Object.assign(a, shapeAttrs(render, p, el, paint, id));
    if (['outline', 'black'].includes(key)) {
      a.fill = key === 'black' ? '#000' : '#fff';
      a.stroke = 'none';
      a['clip-rule'] =
        el.index === undefined
          ? (r.paints.find((p) => p.kind === 'fill')?.rule ?? 'nonzero')
          : p.nodes[el.index]!.clip!.rule;
      return;
    }
    if (key === 'fill-only') {
      a.stroke = 'none';
      return;
    }
    if (key === 'stroke-only') {
      a.fill = 'none';
      a['stroke-width'] = fmt(2 * r.paints.find((p) => p.kind === 'stroke')!.width!);
      return;
    }
  },
};
function shapeAttrs(
  render: SVGRenderer,
  f: DrawFrame,
  el: El,
  paint: Paint,
  id: string,
  paints = f.nodes[el.node]!.paints,
): Attrs {
  const nodes = [...f.nodes];
  nodes[el.node] = { ...nodes[el.node]!, paints };
  return render({ ...f, nodes }, { ...el, role: 'shape' }, paint, id);
}
