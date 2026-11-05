// SVG-specific drawing for paint. Shared by static serialization and retained DOM.
import { fmt, type DrawPaint } from '../../draw.ts';
import { paintColor, type SVGBackend, type Attrs, type Paint } from '../../svg.ts';

export function gradientTree(node: number, key: string, paint: DrawPaint) {
  return {
    tag: paint.type + 'Gradient',
    role: 'module:paint',
    node,
    key,
    kids: paint.stops!.map((_s, index) => ({
      tag: 'stop',
      role: 'module:paint',
      node,
      key,
      index,
      kids: [],
    })),
  };
}
export function gradientAttrs(
  p: DrawPaint,
  node: number,
  key: string,
  index: number | undefined,
  paint: Paint,
  id: string,
  a: Attrs,
): void {
  if (index !== undefined)
    Object.assign(a, {
      offset: fmt(p.stops![index]!.position),
      'stop-color': paintColor(p.stops![index]!.color, paint),
    });
  else {
    Object.assign(a, {
      id: `${id}p${node}-${key}`,
      gradientUnits: 'userSpaceOnUse',
      'color-interpolation': 'sRGB',
    });
    for (const k in p.coordinates) a[k] = fmt(p.coordinates[k]!);
  }
}
export function paintExtras(
  paints: DrawPaint[],
  node: number,
  _paint: Paint,
  id: string,
  a: Attrs,
): void {
  for (const p of paints) {
    const key = p.kind;
    if (p.type && a[key] !== 'none') a[key] = `url(#${id}p${node}-${key})`;
    if (p.kind === 'stroke') {
      if (p.dash && !a['stroke-dasharray']) {
        a.pathLength = p.dashNormalized ? '1' : null;
        a['stroke-dasharray'] = (p.dashNormalized ?? p.dash).map(fmt).join(' ');
        a['stroke-dashoffset'] = fmt(p.dashOffsetNormalized ?? p.dashOffset!);
      }
      if (p.scale === 'fixed') a['vector-effect'] = 'non-scaling-stroke';
    }
  }
}
export const paintSVG: SVGBackend = {
  tree(draw, tree) {
    for (const resource of draw.resources)
      if (resource.kind === 'gradient') {
        // Stop count and kind are static resource metadata, populated by draw.tree.
        const p = resource as typeof resource & { paint: DrawPaint };
        tree.defs.push(gradientTree(p.node, p.key!, p.paint));
      }
  },
  attrs(f, el, paint, id, a) {
    if (el.role === 'module:paint') {
      const parts = el.key!.split('.');
      const nested = parts.length > 1;
      const key = nested ? parts[2]! : el.key!;
      const selected = nested
        ? f.nodes[el.node]!.paints[+parts[1]!]!
        : f.nodes[el.node]!.paints.find((p) => p.kind === key)!;
      gradientAttrs(selected, el.node, key, el.index, paint, nested ? `${id}m${parts[1]}-` : id, a);
    } else if (el.role === 'shape') paintExtras(f.nodes[el.node]!.paints, el.node, paint, id, a);
  },
};
