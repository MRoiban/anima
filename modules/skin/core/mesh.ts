import type { NodeM } from '../../../packages/core/src/load.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { SkinData } from './index.ts';

export function meshRest(n: NodeM): [number, number][] {
  const r = n.raw,
    m = r.mesh;
  if (!m) return [];
  if (m.vertices) return m.vertices.map((v: number[]) => [v[0], v[1]]);
  const [cols, rows] = m.grid,
    out: [number, number][] = [];
  for (let y = 0; y <= rows; y++)
    for (let x = 0; x <= cols; x++)
      out.push([r.x0 + (r.width * x) / cols, r.y0 + (r.height * y) / rows]);
  return out;
}

export function skinMeshPoints(
  p: Player,
  node: number,
  xy: number[],
  s: SkinData,
  move: (
    p: Player,
    node: number,
    k: number,
    part: 'point' | 'in' | 'out',
    point: [number, number],
    s: SkinData,
  ) => [number, number],
): void {
  for (let k = 0; k * 2 < xy.length; k++) {
    const base: [number, number] = [xy[k * 2]!, xy[k * 2 + 1]!],
      q = move(p, node, k, 'point', s.rest[k] ?? base, s);
    xy[k * 2] = q[0];
    xy[k * 2 + 1] = q[1];
  }
}
