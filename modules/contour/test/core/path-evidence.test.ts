import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { load, Player, drawFrame } from '@anima-format/core';
import { compileVertices } from '../../core/index.ts';
import { parsePath } from '../../../../packages/core/src/path.ts';
// Observer output is native path geometry AFTER effects, not a reconstruction from Anima.
const commands = (text: string) =>
  text
    .split(/\n/)
    .filter(Boolean)
    .map((line) => {
      const [, , verb, ...points] = line.split(' ');
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
it('matches native rounded cut points and cubic controls within float32/serialization rounding', () => {
  const a = anima('rounded-vertex'),
    b = native('rounded-vertex');
  expect(a.map((c) => c.verb)).toEqual(b.map((c) => c.verb));
  const max = Math.max(
    ...a.flatMap((c, i) => c.points.map((v, k) => Math.abs(v - b[i]!.points[k]!))),
  );
  expect(max).toBeLessThan(0.0001);
});

it.each(['rounded', 'rounded-angles'])(
  'matches independent acute/right/obtuse native corner controls: %s',
  (file) => {
    const probes: { next: [number, number]; commands: string[] }[] = JSON.parse(
      readFileSync(`modules/paint/probes/${file}.json`, 'utf8'),
    );
    for (const probe of probes) {
      const d = compileVertices([
        { point: file === 'rounded' ? [24, 120] : [24, 48], kind: 'straight' },
        { point: [72, 48], kind: 'rounded', radius: 12 },
        { point: probe.next, kind: 'straight' },
      ]);
      const actual = parsePath(d)[0]!.segs;
      const native = commands(probe.commands.join('\n'));
      // At a 180-degree reversal the native path omits a zero-length corner cubic.
      if (file === 'rounded-angles' && probe.next[0] === 24 && probe.next[1] === 48) {
        expect(actual.slice(6, 13)).toEqual([2, 60, 48, 60, 48, 60, 48]);
        actual.splice(6, 7); // remove only the proven zero-length cubic
      }
      const points = native.flatMap((c) => c.points);
      const values: number[] = [];
      for (let i = 0; i < actual.length;) {
        const op = actual[i++]!;
        const count = op === 2 ? 6 : op === 3 ? 0 : 2;
        values.push(...actual.slice(i, i + count));
        i += count;
      }
      expect(values).toHaveLength(points.length);
      expect(Math.max(...values.map((v, k) => Math.abs(v - points[k]!)))).toBeLessThan(0.0001);
    }
  },
);
