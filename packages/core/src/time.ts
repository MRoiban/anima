// Spec §5: one absolute boundary rule, in the compared clock's seconds.
export const TIME_EPSILON = 1e-9;
export const reached = (time: number, boundary: number): boolean => time >= boundary - TIME_EPSILON;
export const snapTime = (time: number, boundary: number): number =>
  Math.abs(time - boundary) <= TIME_EPSILON ? boundary : time;
/** Floor a time/span ratio, recognizing a reached grid tick before division rounding. */
export const timeFloor = (time: number, span: number): number => {
  const tick = Math.round(time / span);
  return snapTime(time, tick * span) === tick * span ? tick : Math.floor(time / span);
};
/** Fold by span segments so a reached turn/seam returns an exact endpoint. */
export const foldTime = (time: number, span: number, pingpong: boolean): number => {
  const segment = timeFloor(time, span);
  const local = snapTime(time - segment * span, 0);
  return pingpong && Math.abs(segment % 2) === 1 ? span - local : local;
};
