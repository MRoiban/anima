import type { Mat } from '../../../packages/core/src/geom.ts';
/** Source viewBox to a CSS viewport, independent of device pixel ratio. */
export function inputMatrix(
  box: readonly number[],
  width: number,
  height: number,
  fit = 'contain',
  align = 'center',
): Mat {
  const [x, y, w, h] = box as [number, number, number, number];
  if (
    ![x, y, w, h, width, height].every(Number.isFinite) ||
    w <= 0 ||
    h <= 0 ||
    width <= 0 ||
    height <= 0
  )
    throw Error('anima: invalid input viewport');
  let sx = width / w,
    sy = height / h;
  if (fit === 'none') sx = sy = 1;
  else if (fit !== 'fill') sx = sy = (fit === 'cover' ? Math.max : Math.min)(sx, sy);
  const factor = (lo: string, hi: string) =>
    align.includes(lo) ? 0 : align.includes(hi) ? 1 : 0.5;
  return [
    sx,
    0,
    0,
    sy,
    (width - w * sx) * factor('left', 'right') - x * sx,
    (height - h * sy) * factor('top', 'bottom') - y * sy,
  ];
}
