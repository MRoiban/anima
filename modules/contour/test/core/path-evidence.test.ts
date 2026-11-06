import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { load, Player, drawFrame } from '@anima-format/core';
import { parsePath } from '../../../../packages/core/src/path.ts';
// Observer output is native path geometry AFTER effects, not a reconstruction from Anima.
const commands = (text: string) =>
  text
    .split(/\n/)
    .filter(Boolean)
    .map((line) => {
      const [_, __, verb, ...points] = line.split(' ');
      return { verb, points: points.flatMap((p) => p.split(',').map(Number)) };
    });
const native = (caseName: string) =>
  commands(
    JSON.parse(
      readFileSync(`tests/oracle/drawing-paint-${caseName}/rive/path-dump.json`, 'utf8'),
    ).join('\n'),
  );
const anima = (name: string) => {
  const model = load(
    JSON.parse(readFileSync(`tests/oracle/drawing-paint-${name}/case.ani`, 'utf8')),
  ).model!;
  const frame = drawFrame(new Player(model)),
    node = frame.nodes[0]!;
  const d = node.paints[0]!.geometry?.d ?? node.geometry!.d!;
  return parsePath(d).flatMap((p) => {
    const out: { verb: string; points: number[] }[] = [];
    for (let at = 0; at < p.segs.length;) {
      const op = p.segs[at++]!,
        count = op === 2 ? 6 : op === 3 ? 0 : 2;
      out.push({
        verb: ['moveTo', 'lineTo', 'cubicTo', 'close'][op]!,
        points: p.segs.slice(at, at + count).map((x) => x * 12),
      });
      at += count;
    }
    return out;
  });
};
it.each([
  'straight-vertex',
  'mirrored-vertex',
  'asymmetric-vertex',
  'detached-vertex',
  'trim-sequential',
  'trim-synchronized',
])('native observed %s commands and controls equal Anima at 12px/unit', (name) => {
  expect(anima(name)).toEqual(native(name));
});
it('measures the rounded corner disagreement in control points and the curve', () => {
  const a = anima('rounded-vertex'),
    b = native('rounded-vertex');
  // The cut endpoints coincide within float32 native rounding, but the corner cubic differs.
  const cutDelta = Math.max(...a[1]!.points.map((v, k) => Math.abs(v - b[1]!.points[k]!)));
  expect(cutDelta).toBeLessThan(0.0001);
  const controlDelta = Math.max(
    ...a[2]!.points.slice(0, 4).map((v, k) => Math.abs(v - b[2]!.points[k]!)),
  );
  expect(controlDelta).toBeGreaterThan(0.5);
  const evalAt = (cmd: typeof a, t: number) => {
    const p = [...cmd[1]!.points, ...cmd[2]!.points];
    return [0, 1].map(
      (k) =>
        (1 - t) ** 3 * p[k]! +
        3 * (1 - t) ** 2 * t * p[k + 2]! +
        3 * (1 - t) * t * t * p[k + 4]! +
        t ** 3 * p[k + 6]!,
    );
  };
  let max = 0;
  for (let j = 0; j <= 1000; j++) {
    const x = evalAt(a, j / 1000),
      y = evalAt(b, j / 1000);
    max = Math.max(max, Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!));
  }
  console.log({ roundedControlDelta: controlDelta, roundedCurveDelta: max });
  expect(max).toBeGreaterThan(0.25);
});
