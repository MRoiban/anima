import type { Model } from '../../../packages/core/src/load.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { ObjShape } from '../../../packages/core/src/registry.ts';
import { apply, type Mat } from '../../../packages/core/src/geom.ts';

/** Structurally checked JSON, shared with independently loaded constraint modules. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constraint = { kind: string; strength?: number; [key: string]: any };
export interface RigContext {
  readonly player: Player;
  readonly model: Model;
  /** Solved world frame: bones start at (0,0); ordinary nodes retain grid coordinates. */
  world(node: number): Mat;
  /** Replace a solved frame. A solver that writes other nodes declares them in writes(). */
  setWorld(node: number, matrix: Mat): void;
  /** Document rest frame, in the same coordinate convention as world(). */
  rest(node: number): Mat;
  /** World pivot (bone start), optionally evaluated in a supplied frame. */
  position(node: number, matrix?: Mat): [number, number];
  num(node: number, k: number, key: string, fallback: number): number;
  blend(a: Mat, b: Mat, strength: number, node?: number): Mat;
  // seam(P8-7): queued scroll state is outside authored value slots but still needs a normal rig pass.
  i(): void;
}
export interface ConstraintKind {
  kind: string;
  /** Object fields for both JSON and structural AniML; kind/strength are added by rig. */
  shape: ObjShape;
  /** Referenced node ids. Missing ids are diagnosed by rig before solve. */
  targets(raw: Constraint, model: Model): string[];
  /** Additional node indices written by this solver, excluding its host. */
  writes?(raw: Constraint, node: number, model: Model): number[];
  /** Return the host's desired world frame, or mutate frames with ctx.setWorld(). */
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- multi-write solvers may omit a host replacement.
  solve(ctx: RigContext, node: number, raw: Constraint, k: number): Mat | void;
}
export const constraintKinds = new Map<string, ConstraintKind>();
export function registerConstraint(kind: ConstraintKind): void {
  constraintKinds.set(kind.kind, kind);
}
declare module '../../../packages/core/src/load.ts' {
  interface Model {
    /** Pose after the first solve; true requests exactly one additional solve. */
    rigPose?: (player: Player) => boolean;
  }
}
/** The call site stays in the rig module: no branch in a non-rig Player.step(). */
export function solvePasses(ctx: RigContext, solve: () => void): void {
  solve();
  if (ctx.model.rigPose?.(ctx.player)) solve();
}
export function position(matrix: Mat, pivot: readonly number[] = [0, 0]): [number, number] {
  return apply(matrix, pivot[0]!, pivot[1]!);
}
/** QR decomposition with signed Y scale, shear, and deterministic singular-axis fallback. */
export function decompose(m: Mat, pivot: readonly number[] = [0, 0]): number[] {
  const sx = Math.hypot(m[0], m[1]),
    angle = sx ? Math.atan2(m[1], m[0]) : Math.atan2(-m[2], m[3]),
    c = Math.cos(angle),
    s = Math.sin(angle);
  return [...position(m, pivot), angle, sx, -s * m[2] + c * m[3], c * m[2] + s * m[3]];
}
export function compose(v: number[], pivot: readonly number[] = [0, 0]): Mat {
  const [x, y, r, sx, sy, h] = v as [number, number, number, number, number, number],
    c = Math.cos(r),
    s = Math.sin(r),
    a = c * sx,
    b = s * sx,
    u = c * h - s * sy,
    w = s * h + c * sy;
  return [a, b, u, w, x - a * pivot[0]! - u * pivot[1]!, y - b * pivot[0]! - w * pivot[1]!];
}
/** Componentwise blend around the same pivot; shortest arc, +π wins a half-turn tie. */
export function blend(a: Mat, b: Mat, strength: number, pivot?: readonly number[]): Mat {
  if (strength <= 0) return a;
  if (strength >= 1) return b;
  const x = decompose(a, pivot),
    y = decompose(b, pivot),
    tau = 2 * Math.PI;
  let delta = (((y[2]! - x[2]!) % tau) + tau) % tau;
  if (delta > Math.PI) delta -= tau;
  y[2] = x[2]! + delta;
  return compose(
    x.map((v, i) => v + (y[i]! - v) * strength),
    pivot,
  );
}
