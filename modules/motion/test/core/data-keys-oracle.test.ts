import '../../../../packages/core/src/all.ts';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
it('fresh native data-key interpolation and live endpoint changes: three exact observations', () => {
  const p = new Player(
    load(readFileSync('spec/conformance/data-bind-keyframes/case.ani', 'utf8')).model!,
  );
  for (const [name, dt, peak] of [
    ['quarter', 0.25, 8],
    ['changed', 0.75, 16],
    ['half', 0.01, 4],
  ] as const) {
    p.set('$peak', peak);
    p.step(dt);
    const native = JSON.parse(
      readFileSync(
        new URL('../../oracle/p5b8-keyframes/frames/' + name + '.json', import.meta.url),
        'utf8',
      ),
    );
    expect(p.value('probe.r')).toBe(
      native.viewModel.properties.find((v: { path: string }) => v.path === 'result').value,
    );
  }
});
