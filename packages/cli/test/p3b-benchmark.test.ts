import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  existsSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { load, runScript } from '@anima-format/core';
import { run } from '../src/cli.ts';
const root = new URL('../../../', import.meta.url).pathname;
async function cli(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
it('exposes every on-disk module guide through docs and its list', async () => {
  const list = JSON.parse((await cli('docs', '--list', '--format=json')).out);
  for (const name of readdirSync(join(root, 'modules'))) {
    const files = ['AUTHORING.md', 'SPEC.md'].filter((file) =>
      existsSync(join(root, 'modules', name, file)),
    );
    if (!files.length) continue;
    expect(list).toContain(name);
    const result = await cli('docs', name);
    expect(result.code, name).toBe(0);
    for (const file of files)
      expect(result.out.replace(/^#+ /gm, '')).toContain(
        readFileSync(join(root, 'modules', name, file), 'utf8')
          .trim()
          .replace(/^#+ /gm, ''),
      );
  }
});
it('labels node and root semantics separately and exposes actions and node fields', async () => {
  const result = await cli('schema', 'a11y', '--format=json');
  expect(result.code).toBe(0);
  const schema = JSON.parse(result.out);
  expect(schema.scope).toBe('node.a11y');
  expect(schema.root.scope).toContain('doc.a11y');
  expect(schema.fields.find((f: { ani: string }) => f.ani === 'role').type).toContain('slider');
  expect(schema.fields.map((f: { ani: string }) => f.ani)).toEqual(
    expect.arrayContaining(['checked', 'value', 'activate', 'min', 'max', 'step']),
  );
  expect(schema.actions).toEqual(['tap', 'increase', 'decrease', 'focus']);
  expect((await cli('schema', 'a11y.checked')).code).toBe(0);
  expect((await cli('schema', 'a11y')).out).toContain('root icon semantics');
});
it('advertises headless semantics in help and the agent guide', async () => {
  for (const text of [(await cli('--help')).out, (await cli('docs', 'agent-tools')).out])
    for (const command of [
      'semantics [id]',
      'semantic <id> tap|increase|decrease|focus',
      'snapshot --semantics',
    ])
      expect(text).toContain(command);
});
it('resolves expect like snapshot, preserving exact input precedence and scoped aliases', () => {
  const doc = JSON.parse(
    readFileSync(join(root, 'spec/conformance/components-output-repeat/case.ani'), 'utf8'),
  );
  doc.components.row.nodes.push({
    id: 'box',
    type: 'rect',
    x0: 0,
    y0: 0,
    w: 3,
    h: 2,
    fill: { color: '#000' },
  });
  doc.inputs = { width: { type: 'number', default: 9 } };
  doc.nodes.push({ id: 'volumeFill', type: 'rect', x0: 0, y0: 0, w: 12, h: 2 });
  const { model, diagnostics } = load(doc);
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const result = runScript(
    model!,
    'advance 0\nexpect volumeFill.width == 12\nexpect volumeFill.w == 12\nexpect width == 9\nexpect rows/0/box.width == 3\nexpect $main:items.0.score == 2\nsnapshot volumeFill.width width rows/0/box.width',
  );
  expect(result.diagnostics).toEqual([]);
  expect(result.snapshots[0]!.values).toMatchObject({
    'volumeFill.w': 12,
    width: 9,
    'rows/0/box.w': 3,
  });
});
it('gives one actionable subtraction hint but keeps declared hyphenated paths valid', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'anima-minus-'));
  try {
    const file = join(dir, 'case.animl');
    const source = (expression: string, extra = '') =>
      `<anima version="0.1" name="minus" grid="20" requires="data bind"><model name="State"><number name="volume" default="10"/>${extra}</model><rect id="fill" x0="0" y0="0" width="10" height="2" fill="#000"/><bind target="fill.width" value="${expression}"/></anima>`;
    writeFileSync(file, source('$volume-5'));
    const result = await cli('validate', file, '--format=json');
    expect(result.code).toBe(1);
    const diagnostics = JSON.parse(result.out).diagnostics;
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: 'data-path',
      pointer: expect.any(String),
      message: expect.any(String),
      hint: 'write `$volume - 5` (spaces around the minus): names may contain hyphens',
    });
    writeFileSync(file, source('$volume-5', '<number name="volume-5" default="4"/>'));
    expect((await cli('validate', file)).code).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it('fresh checkout startup gives setup guidance without a module stack', () => {
  const dir = mkdtempSync(join(tmpdir(), 'anima-fresh-'));
  try {
    const main = join(dir, 'main.ts');
    cpSync(join(root, 'packages/cli/src/main.ts'), main);
    writeFileSync(join(dir, 'cli.ts'), "import 'anima-deliberately-missing-dependency';");
    const result = spawnSync(process.execPath, [main, '--help'], { encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(result.stderr).toBe(
      'Anima CLI dependencies are missing; run npm ci at the repo root.\n',
    );
    expect(result.stdout).toBe('');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
