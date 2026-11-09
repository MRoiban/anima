import { mesh } from '../core/index.ts';
import { meshSVG } from '../core/svg.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerModule(mesh);
Icon.registerSVGBackend('mesh', meshSVG);
const previous = Icon.eventHook;
const reported = new WeakSet<object>();
Icon.eventHook = (icon, kind, detail) => {
  previous?.(icon, kind, detail);
  const p = icon.player;
  if (
    kind !== 'draw' ||
    !p ||
    reported.has(p) ||
    icon.getAttribute('renderer') === 'canvas' ||
    !p.model.doc.requires?.includes('mesh')
  )
    return;
  reported.add(p);
  const visit = (nodes: typeof p.model.doc.nodes, base: string) =>
    nodes.forEach((n: { mesh?: unknown; children?: typeof nodes }, i: number) => {
      const path = base + '/' + i;
      if (n.mesh)
        icon.dispatchEvent(
          new CustomEvent('anima:error', {
            detail: [
              {
                code: 'unsupported-render',
                severity: 'warning',
                feature: 'mesh',
                pointer: path + '/mesh',
                message: 'SVG draws the undeformed image',
                hint: 'use renderer="canvas" and import @anima-format/web/canvas-mesh',
              },
            ],
          }),
        );
      if (n.children) visit(n.children, path + '/children');
    });
  visit(p.model.doc.nodes, '/nodes');
};
