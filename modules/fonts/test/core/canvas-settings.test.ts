import { expect, it } from 'vitest';
import { applyCanvasFont } from '../../web/settings.ts';
const spec = {
  family: 'body',
  size: 2,
  weight: 400,
  style: 'normal' as const,
  tracking: 0,
  axes: { wght: 650, wdth: 80 },
  features: { kern: 0, liga: 0 },
};
it('uses native settings when present, resets them and never manufactures unsupported Canvas APIs', () => {
  const native = { font: '', fontKerning: '', fontVariationSettings: '', fontFeatureSettings: '' };
  applyCanvasFont(native as unknown as CanvasRenderingContext2D, spec);
  expect(native).toMatchObject({
    font: 'normal 650 2px body',
    fontKerning: 'none',
    fontVariationSettings: '"wght" 650, "wdth" 80',
    fontFeatureSettings: '"kern" 0, "liga" 0',
  });
  applyCanvasFont(native as unknown as CanvasRenderingContext2D, {
    ...spec,
    axes: undefined,
    features: undefined,
  });
  expect(native).toMatchObject({
    font: 'normal 400 2px body',
    fontKerning: 'normal',
    fontVariationSettings: 'normal',
    fontFeatureSettings: 'normal',
  });
  const fallback = { font: '', fontKerning: '' };
  applyCanvasFont(fallback as unknown as CanvasRenderingContext2D, spec);
  expect(fallback).toEqual({ font: 'normal 650 2px body', fontKerning: 'none' });
});

it('clamps the CSS weight fallback rather than retaining an invalid previous canvas font', () => {
  const ctx = { font: 'old', fontKerning: '' };
  applyCanvasFont(ctx as unknown as CanvasRenderingContext2D, { ...spec, axes: { wght: 2000 } });
  expect(ctx.font).toBe('normal 1000 2px body');
  applyCanvasFont(ctx as unknown as CanvasRenderingContext2D, { ...spec, axes: { wght: -100 } });
  expect(ctx.font).toBe('normal 1 2px body');
});
