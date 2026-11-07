import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { run } from '../../../../packages/cli/src/index.ts';
import { load } from '../../../../packages/core/src/index.ts';
async function cli(args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
describe('componentpaint CLI', () => {
  it.each(['animl', 'ani'])('validates, inspects and samples live source %s', async (extension) => {
    const file = `modules/componentpaint/examples/live.${extension}`;
    expect((await cli(['validate', file])).code).toBe(0);
    expect((await cli(['inspect', file])).code).toBe(0);
    const sample = await cli(['sample', file, '-e', 'advance 0.5; snapshot tile/paint/bar.x']);
    expect(sample.code, sample.err).toBe(0);
    expect(sample.out).toContain('"tile/paint/bar.x":3');
  });
  it('exposes the source field in generated CLI schema and validates the independent invalid fixture', async () => {
    const schema = await cli(['schema', 'rect']);
    expect(schema.code).toBe(0);
    expect(schema.out).toContain('paint ↔ fill.paint');
    const r = load(
      readFileSync(
        'modules/componentpaint/test/core/invalid/drawing-paint-paint-artboard/bad-source.json',
        'utf8',
      ),
    );
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unknown-component',
        pointer: '/nodes/0/fill/paint',
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
  });
});
