import type { DrawFrame, DrawPaint } from '@anima-format/core';
export type CanvasSourceHook = (
  paint: DrawPaint,
  context: CanvasRenderingContext2D,
  render: (frame: DrawFrame, width: number, height: number) => HTMLCanvasElement,
) => CanvasPattern | undefined;
export type CanvasSourceHost = typeof import('../../../packages/web/src/index.ts').AnimaIcon & {
  canvasSources?: CanvasSourceHook[];
};
