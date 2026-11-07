import { expect, it } from 'vitest';
import { run } from '../../../../packages/cli/src/index.ts';
async function cli(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
it('schema/docs/inspect/sample expose lists in both source forms', async () => {
  const schema = await cli('schema', 'repeat');
  expect(schema.code, schema.err).toBe(0);
  for (const key of ['list', 'count', 'component', 'dx', 'dy', 'size'])
    expect(schema.out).toContain(key);
  const docs = await cli('docs', 'lists');
  expect(docs.code, docs.err).toBe(0);
  expect(docs.out).toContain('reserved-name');
  for (const ext of ['ani', 'animl']) {
    const path = new URL('../../examples/players.' + ext, import.meta.url).pathname;
    const inspect = await cli('inspect', path, '--format=json');
    expect(inspect.code, inspect.err).toBe(0);
    const sample = await cli('sample', path, '-e', 'advance 0; snapshot rows/0/dot.r rows/1/dot.x');
    expect(sample.code, sample.err).toBe(0);
    expect(JSON.parse(sample.out).values).toEqual({ 'rows/0/dot.r': 3, 'rows/1/dot.x': 1 });
  }
});

it('inspect lists only existing repeated scalar and trigger slots', async () => {
  for (const ext of ['ani', 'animl']) {
    const inspected = await cli(
      'inspect',
      'spec/conformance/lists-readable-count/case.' + ext,
      '--format=json',
    );
    expect(inspected.code, inspected.err).toBe(0);
    const inputs = JSON.parse(inspected.out).inputs;
    for (const id of ['rows', 'chars']) {
      for (const index of [0, 1]) {
        expect(inputs[`${id}.${index}.clicks`]).toBe('number');
        expect(inputs[`${id}.${index}.tap`]).toBe('trigger');
      }
      expect(Object.keys(inputs).filter((k) => k.startsWith(id + '.'))).toHaveLength(4);
    }
  }
});

it('inspect prunes absent repeat slots inside an ordinary component', async () => {
  const { mkdtempSync, readFileSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'anima-inspect-'));
  try {
    const document = JSON.parse(
      readFileSync('spec/conformance/lists-readable-count/case.ani', 'utf8'),
    );
    document.components.wrapper = { grid: 20, nodes: document.nodes };
    document.nodes = [{ id: 'outer', type: 'instance', component: 'wrapper' }];
    const file = join(dir, 'nested.ani');
    writeFileSync(file, JSON.stringify(document));
    const inspected = await cli('inspect', file, '--format=json');
    expect(inspected.code, inspected.err).toBe(0);
    const inputs = JSON.parse(inspected.out).inputs;
    for (const name of ['rows', 'chars']) {
      expect(inputs[`outer.${name}.0.tap`]).toBe('trigger');
      expect(inputs[`outer.${name}.1.clicks`]).toBe('number');
      expect(Object.keys(inputs).filter((key) => key.startsWith(`outer.${name}.`))).toHaveLength(4);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
