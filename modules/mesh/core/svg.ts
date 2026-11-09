import type { SVGBackend } from '../../../packages/core/src/svg.ts';
import { drawFrame } from '../../../packages/core/src/draw.ts';
import { svgBackends } from '../../../packages/core/src/svg.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
// Default tooling SVG rejects mesh output. Browser SVG retains assets' undeformed image.
// The check is never called by retained DOM, including verbose browser builds.
export const meshSVG: SVGBackend = V
  ? {
      checkStatic(player) {
        if (svgBackends.has('mesh-tool')) return;
        const frame = drawFrame(player),
          node = frame.nodes.findIndex((n) => n.mesh);
        if (node < 0) return;
        throw Object.assign(new Error('mesh requires canvas or static triangle output'), {
          code: 'unsupported-render',
          feature: 'mesh',
          pointer: frame.tree.nodes[node]!.pointer! + '/mesh',
          hint: 'use renderer="canvas" or the CLI render command (meshTriangles: true)',
        });
      },
    }
  : {};
