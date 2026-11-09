import { geometryLength, type DrawFrame, type DrawNode } from '../../../packages/core/src/draw.ts';

export function skinDash(node: number, draw: DrawNode, frame: DrawFrame): void {
  if (!draw.geometry) return;
  const length = geometryLength(draw.geometry, frame.tree.nodes[node]);
  for (const paint of draw.paints)
    if (paint.dashNormalized) {
      paint.dash = paint.dashNormalized.map((v) => v * length);
      paint.dashOffset = (paint.dashOffsetNormalized ?? 0) * length;
    }
}
