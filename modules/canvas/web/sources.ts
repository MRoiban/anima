import type { DrawFrame, DrawPaint } from '@anima-format/core';
export type CanvasSourceHook = (
  paint: DrawPaint,
  context: CanvasRenderingContext2D,
  render: (frame: DrawFrame, width: number, height: number) => HTMLCanvasElement,
) => CanvasPattern | undefined;
export type CanvasSourceHost = typeof import('../../../packages/web/src/index.ts').AnimaIcon & {
  canvasSources?: CanvasSourceHook[];
  canvasShapes?: ((
    ctx: CanvasRenderingContext2D,
    node: import('@anima-format/core').DrawNode,
    brush: (paint: DrawPaint) => string | CanvasGradient | CanvasPattern,
  ) => boolean)[];
};
