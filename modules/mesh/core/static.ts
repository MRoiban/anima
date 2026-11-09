import {
  toSVG as serialize,
  registerSVGBackend,
  svgBackends,
  fmt,
  type El,
  type SVGBackend,
} from '../../../packages/core/src/svg.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import { drawFrame } from '../../../packages/core/src/draw.ts';
import { mul, invert, type Mat } from '../../../packages/core/src/geom.ts';
export function affine(points: number[], uv: number[], tri: number[]): Mat | undefined {
  const matrix = (xy: number[]): Mat => {
    const [a, b, c] = tri.map((k) => xy.slice(2 * k, 2 * k + 2));
    return [b![0]! - a![0]!, b![1]! - a![1]!, c![0]! - a![0]!, c![1]! - a![1]!, a![0]!, a![1]!];
  };
  const inverse = invert(matrix(uv));
  return inverse ? mul(matrix(points), inverse) : undefined;
}
/** Tooling only: no triangle serializer is imported by a browser entry. */
export function toSVG(
  p: Player,
  opts: Parameters<typeof serialize>[1] & { meshTriangles?: boolean } = {},
): string {
  if (!opts.meshTriangles) return serialize(p, opts);
  const frame = drawFrame(p);
  const backend: SVGBackend = {
    tree(_draw, tree) {
      const visit = (els: El[]) => {
        for (const el of els) {
          const m = frame.nodes[el.node]?.mesh;
          if (el.role === 'module:image-box' && m) {
            el.tag = 'g';
            el.role = 'module:mesh';
            el.kids = [];
            for (let k = 0; k < m.triangles.length; k++) {
              if (!affine(m.points, m.uv, m.triangles[k]!)) continue;
              const node = el.node,
                index = k;
              tree.defs.push({
                tag: 'clipPath',
                role: 'module:mesh-clip',
                node,
                index,
                kids: [{ tag: 'path', role: 'module:mesh-path', node, index, kids: [] }],
              });
              el.kids.push({
                tag: 'g',
                role: 'module:mesh-triangle',
                node,
                index,
                kids: [{ tag: 'image', role: 'module:mesh-image', node, index, kids: [] }],
              });
            }
          } else visit(el.kids);
        }
      };
      visit(tree.root);
      // Work on a copy: definitions appended above are already authored in mesh space.
      visit([...tree.defs]);
    },
    attrs(f, el, _paint, id, a) {
      if (!el.role.startsWith('module:mesh')) return;
      const n = f.nodes[el.node]!,
        m = n.mesh!,
        t = m.triangles[el.index ?? 0]!;
      const clip = `${id}mesh${el.node}-${el.index}`;
      if (el.role === 'module:mesh-clip')
        Object.assign(a, { id: clip, clipPathUnits: 'userSpaceOnUse' });
      if (el.role === 'module:mesh-path')
        a.d =
          'M' +
          t
            .map((k) =>
              m.points
                .slice(2 * k, 2 * k + 2)
                .map(fmt)
                .join(' '),
            )
            .join('L') +
          'Z';
      if (el.role === 'module:mesh-triangle') a['clip-path'] = `url(#${clip})`;
      if (el.role === 'module:mesh-image')
        Object.assign(a, {
          href: n.geometry!.image!.source,
          width: '1',
          height: '1',
          preserveAspectRatio: 'none',
          transform: `matrix(${affine(m.points, m.uv, t)!.map(fmt).join(' ')})`,
          'image-rendering': n.geometry!.image!.sampling === 'nearest' ? 'pixelated' : 'auto',
        });
    },
  };
  registerSVGBackend('mesh-tool', backend);
  try {
    return serialize(p, opts);
  } finally {
    svgBackends.delete('mesh-tool');
  }
}
