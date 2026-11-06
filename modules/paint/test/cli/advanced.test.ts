import { globSync } from 'node:fs';
import { it, expect } from 'vitest';
import { run } from '../../../../packages/cli/src/index.ts';
async function cli(args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
it('validates all new paint, contour and mix probes in both authoring spellings', async () => {
  const files = globSync('spec/conformance/drawing-paint-*/case.{ani,animl}');
  // Existing seventeen probes plus four image fit/wrap probes, both spellings.
  expect(files).toHaveLength(42);
  for (const file of files) {
    const r = await cli(['validate', file]);
    expect(r.code, file + ': ' + r.err).toBe(0);
  }
});
it('exposes the new geometry and paint fields through CLI schema', async () => {
  const contour = await cli(['schema', 'contour']);
  expect(contour.code).toBe(0);
  expect(contour.out).toContain('vertices');
  expect(contour.out).toContain('geometryOrigin');
  const rect = await cli(['schema', 'rect']);
  expect(rect.code).toBe(0);
  expect(rect.out).toContain('mix');
});
