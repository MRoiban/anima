import '../../../../packages/core/src/all.ts';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
const read = (file: string) =>
  JSON.parse(readFileSync(new URL('../../oracle/p5b8/' + file, import.meta.url), 'utf8'));
it('compares typed component literals to fresh native equality/mismatch readback exactly', () => {
  const doc = JSON.parse(
    readFileSync('spec/conformance/state-machine-literal-artboard/case.ani', 'utf8'),
  );
  doc.components.box = {
    grid: 10,
    nodes: [{ id: 'box', type: 'circle', center: [5, 5], r: 2, fill: { color: '#000' } }],
  };
  for (const name of ['row', 'box']) {
    doc.data.models.Card.properties.card.default = name;
    const p = new Player(load(doc).model!);
    p.step(0);
    const native = read('guard-' + name + '/frames/result.json').viewModel.properties.find(
      (p: { path: string }) => p.path === 'result',
    ).value;
    expect(p.value('probe.r')).toBe(native);
  }
});
it('retains the quantize delta1 finding; partitioned and direct advances have the same native boundary miss', () => {
  const doc = readFileSync('spec/conformance/components-nested-quantize/case.ani', 'utf8');
  const p = new Player(load(doc).model!);
  p.step(0.12);
  p.step(0.13);
  const nestedX = (file: string) => read(file).nested[0].viewModels[0].properties[0].value;
  const native = nestedX('quantize/frames/p1.json');
  expect(native).toBe(2);
  expect(nestedX('quantize/frames/p0.json')).toBe(native);
  expect(p.value('badge/dot.x')).toBe(3);
  expect(Number(p.value('badge/dot.x')) - native).toBe(1);
  // This records observations, not passing equivalence at an adjusted threshold.
  expect(nestedX('fps-near/frames/result.json')).toBe(2);
  expect(nestedX('fps-high/frames/result.json')).toBe(2.99999976);
  expect(Math.fround(12.0000001)).toBe(12);
  expect(Math.fround(12.000001)).toBe(12.000000953674316);
});
it('keeps the specified 1e-9-second boundary at nearby source times', () => {
  const doc = JSON.parse(
    readFileSync('spec/conformance/components-nested-quantize/case.ani', 'utf8'),
  );
  doc.nodes[0].time = '$t';
  for (const [t, want] of [
    [0.25 - 2e-9, 2],
    [0.25 - 5e-10, 3],
    [0.25, 3],
    [0.25 + 5e-10, 3],
  ]) {
    const p = new Player(load(doc).model!);
    p.set('$t', t!);
    p.step(0);
    expect(p.value('badge/dot.x')).toBe(want);
  }
});
