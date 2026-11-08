import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { run } from '../../../../packages/cli/src/cli.ts';
it('validates both syntaxes, exposes schema, samples boxes, and renders a hugging bound label', async () => {
  const output: string[] = [],
    errors: string[] = [],
    io = {
      out: (s: string) => output.push(s),
      write: (s: string) => output.push(s),
      err: (s: string) => errors.push(s),
    };
  for (const ext of ['ani', 'animl'])
    expect(await run(['validate', `modules/layout/examples/button.${ext}`], io)).toBe(0);
  expect(await run(['schema', 'layout'], io)).toBe(0);
  expect(output.join('\n')).toContain('direction');
  output.length = 0;
  expect(
    await run(
      [
        'sample',
        'spec/conformance/data-bind-layout/case.ani',
        '--script',
        'spec/conformance/data-bind-layout/script.txt',
      ],
      io,
    ),
  ).toBe(0);
  expect(output.join('\n')).toContain('"a.layoutBox.width":5');
  const dir = mkdtempSync(join(tmpdir(), 'anima-layout-'));
  try {
    const path = join(dir, 'button.svg');
    expect(await run(['render', 'modules/layout/examples/button.ani', '-o', path], io)).toBe(0);
    expect(readFileSync(path, 'utf8')).toContain('#d97757');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  for (const ext of ['ani', 'animl'])
    expect(await run(['validate', `modules/layout/examples/reflow.${ext}`], io)).toBe(0);
  output.length = 0;
  expect(
    await run(
      [
        'sample',
        'spec/conformance/layout-animated-reflow/case.ani',
        '--script',
        'spec/conformance/layout-animated-reflow/script.txt',
      ],
      io,
    ),
  ).toBe(0);
  expect(output.join('\n')).toContain('"root.drawnLayoutBox.width":14');
  expect(errors).toEqual([]);
});
