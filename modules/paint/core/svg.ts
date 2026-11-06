import type { DrawFrame } from '../../../packages/core/src/draw.ts';
import type { El } from '../../../packages/core/src/svg.ts';
import { samplingSVG } from './sampling.ts';
// SVG-specific drawing for paint. Shared by static serialization and retained DOM.
import { fmt, type DrawPaint } from '../../../packages/core/src/draw.ts';
import {
  paintColor,
  type SVGBackend,
  type Attrs,
  type Paint,
} from '../../../packages/core/src/svg.ts';

export class UnsupportedPaintRenderError extends Error {
  readonly code = 'unsupported-render';
  readonly hint = 'use the canvas renderer for angular gradients';
  readonly pointer: string;
  constructor(pointer: string, key: string) {
    super('SVG cannot faithfully render angular gradients');
    this.pointer = `${pointer}/${key.replaceAll('.', '/')}/type`;
  }
}

export function gradientTree(
  node: number,
  key: string,
  paint: DrawPaint,
  pointer = `/nodes/${node}`,
) {
  if (paint.type === 'angular') throw new UnsupportedPaintRenderError(pointer, key);
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
    if (p.gradientTransform)
      a.gradientTransform = `matrix(${p.gradientTransform.map(fmt).join(' ')})`;
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
        a.pathLength = null;
        a['stroke-dasharray'] = p.dash.map(fmt).join(' ');
        a['stroke-dashoffset'] = fmt(p.dashOffset!);
      }
      if (p.scale === 'fixed') a['vector-effect'] = 'non-scaling-stroke';
    }
  }
}
const gradientsSVG: SVGBackend = {
  tree(draw, tree) {
    for (const resource of draw.resources)
      if (resource.kind === 'gradient') {
        // Stop count and kind are static resource metadata, populated by draw.tree.
        const p = resource as typeof resource & { paint: DrawPaint };
        tree.defs.push(gradientTree(p.node, p.key!, p.paint, draw.nodes[p.node]!.pointer));
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

// Keep the shared image viewport seam small; sampling implementation stays optional.
function imageBox(f: DrawFrame, el: El, a: Attrs) {
  if (el.role === 'module:image-box') {
    const g = f.nodes[el.node]!.geometry!;
    a.style = `width:${fmt(g.width!)}px;height:${fmt(g.height!)}px;overflow:hidden`;
  }
}
// The browser's normal paint entry excludes pattern code. The optional entry replaces it.
export const paintSVGBase: SVGBackend = {
  ...gradientsSVG,
  attrs(f, el, paint, id, a, render) {
    imageBox(f, el, a);
    const image = f.nodes[el.node]!.geometry?.image;
    if (el.role === 'module:image' && image && f.tree.nodes[el.node]!.imageWrap) {
      throw Object.assign(new Error('image wrapping needs the optional SVG sampling backend'), {
        code: 'unsupported-render',
        pointer: f.tree.nodes[el.node]!.pointer ?? '/nodes/' + el.node,
        hint: 'import @anima-format/web/paint-sampling',
      });
    }
    gradientsSVG.attrs?.(f, el, paint, id, a, render);
  },
};
export const paintSVG: SVGBackend = {
  tree(draw, tree) {
    gradientsSVG.tree?.(draw, tree);
    samplingSVG.tree?.(draw, tree);
  },
  attrs(f, el, paint, id, a, render) {
    imageBox(f, el, a);
    gradientsSVG.attrs?.(f, el, paint, id, a, render);
    samplingSVG.attrs?.(f, el, paint, id, a, render);
  },
};
