import { expect, it } from 'vitest';
import { run } from '../../../../packages/cli/src/index.ts';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
async function cli(...argv: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(argv, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
it('CLI schema, validate, sample and browser-text SVG rendering expose effects', async () => {
  const file = 'modules/text-effects/examples/title-wave.animl';
  expect((await cli('validate', file)).code).toBe(0);
  const schema = await cli('schema', 'text', '--format=json');
  expect(schema.code).toBe(0);
  expect(schema.out).toContain('text-effects');
  expect((await cli('sample', file)).code).toBe(0);
  const dir = mkdtempSync(join(tmpdir(), 'anima-effect-cli-'));
  try {
    const target = join(dir, 'title.svg');
    const rendered = await cli(
      'render',
      file,
      '--browser-text',
      '--font',
      'sans-serif=fixtures/fonts/anima-test.ttf',
      '--at',
      '0.5',
      '-o',
      target,
    );
    expect(rendered, rendered.err).toMatchObject({ code: 0 });
    const svg = readFileSync(target, 'utf8');
    expect(svg).toContain('matrix(');
    expect(svg).toContain('opacity=');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 30000);
