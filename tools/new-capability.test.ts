import {
  mkdirSync,
  readdirSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { dryRun, scaffold } from './new-capability.ts';
import { generate } from './modules.ts';
import { pendingReason } from './pending.ts';
import { lint, outputs, type Row } from './parity.ts';

const source = resolve(import.meta.dirname, '..');
function scratch() {
  const root = mkdtempSync(resolve(tmpdir(), 'anima-scaffold-test-'));
  cpSync(source, root, {
    recursive: true,
    filter: (p) => !['.git', 'node_modules', 'dist'].includes(p.split('/').at(-1)!),
  });
  mkdirSync(resolve(root, 'node_modules/@anima-format'), { recursive: true });
  for (const name of readdirSync(resolve(source, 'node_modules'))) {
    if (name !== '@anima-format')
      symlinkSync(resolve(source, 'node_modules', name), resolve(root, 'node_modules', name));
  }
  for (const name of ['core', 'markup', 'web', 'cli', 'playground'])
    symlinkSync(resolve(root, 'packages', name), resolve(root, 'node_modules/@anima-format', name));
  return root;
}

it('plans without writing, is idempotent, and generates a registered, typechecked module', async () => {
  const root = scratch();
  const id = 'animation.frame-grid';
  mkdirSync(resolve(root, 'tests/oracle/animation-frame-grid/rive'), { recursive: true });
  writeFileSync(
    resolve(root, 'tests/oracle/animation-frame-grid/rive/README.md'),
    'Existing reference notes\n',
  );
  const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
  try {
    const inventory = read('docs/parity/inventory.json');
    const plan = await dryRun(root, id, 'capabilityprobe');
    const listing = execFileSync(
      process.execPath,
      [resolve(root, 'tools/new-capability.ts'), id, '--module', 'capabilityprobe', '--dry-run'],
      { encoding: 'utf8' },
    );
    expect(listing.split('\n').slice(1).filter(Boolean)).toEqual(plan);
    expect(read('docs/parity/inventory.json')).toBe(inventory);
    expect(plan).toContain('modules/capabilityprobe/core/index.ts');
    expect(plan).toContain('packages/web/src/capabilityprobe.ts');
    expect(plan).toContain('spec/conformance/animation-frame-grid/todo.json');
    expect(await scaffold(root, id, 'capabilityprobe')).toEqual(plan);
    expect(read('tests/oracle/animation-frame-grid/rive/README.md')).toBe(
      'Existing reference notes\n',
    );
    expect(await scaffold(root, id, 'capabilityprobe')).toEqual([]);
    expect(await generate(root, true)).toEqual([]);
    const rows: Row[] = JSON.parse(read('docs/parity/inventory.json'));
    expect(lint(rows)).toEqual([]);
    expect(rows.find((r) => r.id === id)!.anima.status).toBe('planned');
    for (const [path, text] of Object.entries(outputs(rows)))
      expect(read(`docs/parity/${path}`)).toBe(text);
    expect(pendingReason(resolve(root, 'spec/conformance/animation-frame-grid'))).toContain(id);
    expect(pendingReason(resolve(root, 'tests/oracle/animation-frame-grid'))).toContain(id);
    const url = pathToFileURL(resolve(root, 'packages/core/src/all.ts')).href;
    const registry = pathToFileURL(resolve(root, 'packages/core/src/modules.ts')).href;
    const result = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `await import(${JSON.stringify(url)}); const { modules } = await import(${JSON.stringify(registry)}); console.log(modules.has('capabilityprobe'));`,
      ],
      { encoding: 'utf8' },
    );
    expect(result.trim()).toBe('true');
    execFileSync(
      process.execPath,
      [resolve(source, 'node_modules/typescript/bin/tsc'), '-p', 'packages/web'],
      { cwd: root, stdio: 'inherit' },
    );
    execFileSync(
      process.execPath,
      [
        resolve(source, 'node_modules/vitest/vitest.mjs'),
        'run',
        '--config',
        'vitest.scope.config.ts',
        '--reporter=json',
        '--outputFile=pending-report.json',
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          ANIMA_TEST_SCOPE: JSON.stringify({
            unit: [
              'tools/oracle.test.ts',
              'modules/capabilityprobe/test/core/animation-frame-grid.test.ts',
            ],
            conformance: ['packages/core/test/conformance.test.ts'],
            browser: [],
          }),
        },
      },
    );
    const report = JSON.parse(read('pending-report.json'));
    expect(report.numTodoTests).toBeGreaterThanOrEqual(3); // diagnostic + conformance + oracle, no false passes
    expect(report.numFailedTests).toBe(0);
    const probes = report.testResults
      .flatMap(
        (test: { assertionResults: { fullName: string; status: string }[] }) =>
          test.assertionResults,
      )
      .filter(
        (test: { fullName: string }) =>
          test.fullName.includes('animation-frame-grid') ||
          test.fullName.includes('animation.frame-grid: diagnostic'),
      );
    expect(probes).toHaveLength(3);
    expect(probes.every((test: { status: string }) => test.status === 'todo')).toBe(true);
    // Preserve coder edits and add a second capability to the same module.
    writeFileSync(
      resolve(root, 'modules/capabilityprobe/capabilities/animation-frame-grid/registry.ts'),
      '// coder edit\n',
    );
    await scaffold(root, 'animation.seek', 'capabilityprobe');
    expect(read('modules/capabilityprobe/capabilities/animation-frame-grid/registry.ts')).toBe(
      '// coder edit\n',
    );
    expect(await scaffold(root, 'animation.seek', 'capabilityprobe')).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 60000);

it('rejects invalid requests without writes and notes unsupported oracle counterparts', async () => {
  const root = scratch();
  try {
    const before = readFileSync(resolve(root, 'spec/SPEC.md'), 'utf8');
    await expect(scaffold(root, 'missing')).rejects.toThrow('Unknown parity row');
    await expect(scaffold(root, 'animation.frame-grid', '../bad')).rejects.toThrow('Module name');
    await expect(scaffold(root, 'animation.speed')).rejects.toThrow('already done');
    expect(readFileSync(resolve(root, 'spec/SPEC.md'), 'utf8')).toBe(before);
    const files = await scaffold(root, 'tooling.binary-rive-io');
    expect(files.some((f) => f.startsWith('tests/oracle/'))).toBe(false);
    expect(
      readFileSync(
        resolve(root, 'modules/tooling/capabilities/tooling-binary-rive-io/README.md'),
        'utf8',
      ),
    ).toContain('oracle skipped');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('requires an explicit nonempty pending marker', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'anima-pending-'));
  try {
    expect(pendingReason(root)).toBeUndefined();
    writeFileSync(resolve(root, 'todo.json'), '{}');
    expect(() => pendingReason(root)).toThrow('expected');
    writeFileSync(
      resolve(root, 'todo.json'),
      JSON.stringify({ status: 'todo', reason: 'unimplemented' }),
    );
    expect(pendingReason(root)).toBe('unimplemented');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('prints help without treating the flag as a parity row', () => {
  for (const flag of ['--help', '-h'])
    expect(
      execFileSync(process.execPath, [resolve(source, 'tools/new-capability.ts'), flag], {
        encoding: 'utf8',
      }),
    ).toContain('Usage:');
});
