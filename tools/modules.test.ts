import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { generate, ordered, type Manifest } from './modules.ts';

it('adds a module using only new module files, generating all wiring into a temporary repo', async () => {
  const root = mkdtempSync(join(tmpdir(), 'anima-modules-'));
  const put = (path: string, text: string) => {
    const parts = path.split('/');
    parts.pop();
    mkdirSync(join(root, ...parts), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const read = (path: string) => readFileSync(join(root, path), 'utf8');
  try {
    for (const pkg of ['core', 'markup', 'web'])
      put(
        `packages/${pkg}/package.json`,
        JSON.stringify({ type: 'module', exports: { '.': './src/index.ts' } }),
      );
    put('packages/core/src/flags.ts', 'export const VERBOSE = true;');
    put(
      'packages/core/src/modules.ts',
      'export const modules = new Map(); export function registerModule(m) { modules.set(m.name, m); }',
    );
    put(
      'packages/core/src/svg.ts',
      'export const backends = new Map(); export function registerSVGBackend(name, backend) { backends.set(name, backend); }',
    );
    mkdirSync(join(root, 'modules'));
    await generate(root);
    expect(await generate(root, true)).toEqual([]);
    const probe: Manifest = {
      name: 'probe',
      after: [],
      core: { entry: 'core/index.ts', export: 'probe', svg: 'core/svg.ts', svgExport: 'probeSVG' },
      web: [
        { name: 'probe', budget: 128 },
        { name: 'markup-probe', budget: 64, over: 'index' },
      ],
      adapters: {
        'packages/core/src/modules/probe/index.ts': 'core/index.ts',
        'packages/core/src/modules/probe/svg.ts': 'core/svg.ts',
        'packages/markup/src/probe.ts': 'markup/index.ts',
        'packages/web/src/probe.ts': 'web/index.ts',
        'packages/web/src/markup-probe.ts': 'web/markup.ts',
      },
      exports: {
        'core:./probe': 'packages/core/src/modules/probe/index.ts',
        'markup:./probe': 'packages/markup/src/probe.ts',
        'web:./probe': 'packages/web/src/probe.ts',
      },
      markupHook: { slot: 'probeCompiler', type: 'probeMarkup', value: 'probeMarkup' },
      tests: ['modules/probe/test/**/*.test.ts'],
      conformance: ['probe-'],
      docs: ['modules/probe/README.md'],
    };
    // The only author-written changes are additions under this new folder.
    put('modules/probe/manifest.ts', `export default ${JSON.stringify(probe)};`);
    for (const local of Object.values(probe.adapters)) put(`modules/probe/${local}`, 'export {};');
    put('modules/probe/core/index.ts', "export const probe = { name: 'probe', entries: [] };");
    put('modules/probe/core/svg.ts', 'export const probeSVG = {};');
    put('modules/probe/markup/index.ts', 'export const probeMarkup = {};');
    put(
      'modules/probe/test/core/probe.test.ts',
      '// Fixture-owned test selected by the manifest glob.',
    );
    put('modules/probe/README.md', 'Probe docs');
    expect(await generate(root, true)).toContain('packages/core/src/all.ts');
    expect(read('packages/core/src/all.ts')).not.toContain('registerModule(probe)'); // --check never writes
    await generate(root);
    expect(read('packages/core/src/all.ts')).toContain('registerModule(probe)');
    expect(read('packages/core/src/all.ts')).toContain("registerSVGBackend('probe', probeSVG)");
    expect(read('packages/markup/src/module-hooks.ts')).toContain(
      'Object.assign(probeCompiler, probeMarkup)',
    );
    const tables = read('tools/modules.generated.ts');
    for (const marker of [
      'webEntries',
      'moduleBudgets',
      'moduleScopes',
      'markup-probe',
      '128',
      '64',
      'probe-',
      'modules/probe/test/',
    ])
      expect(tables).toContain(marker);
    for (const pkg of ['core', 'markup', 'web'])
      expect(JSON.parse(read(`packages/${pkg}/package.json`)).exports['./probe']).toBeDefined();
    expect(await generate(root, true)).toEqual([]);
    const url = (path: string) => JSON.stringify(pathToFileURL(join(root, path)).href);
    const registered = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      await import(${url('packages/core/src/all.ts')});
      const { modules } = await import(${url('packages/core/src/modules.ts')});
      const { backends } = await import(${url('packages/core/src/svg.ts')});
      console.log(JSON.stringify([[...modules.keys()], [...backends.keys()]]));
    `,
      ],
      { encoding: 'utf8' },
    );
    expect(JSON.parse(registered)).toEqual([['probe'], ['probe']]);
    put('packages/web/src/probe.ts', '// stale');
    expect(await generate(root, true)).toContain('packages/web/src/probe.ts');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('rejects unknown ordering dependencies and cycles', () => {
  const m = (name: string, after: string[]) => ({ name, after }) as Manifest;
  expect(() => ordered([m('a', ['missing'])])).toThrow('unknown after');
  expect(() => ordered([m('a', ['b']), m('b', ['a'])])).toThrow('cycle');
  expect(ordered([m('b', ['a']), m('a', [])]).map((m) => m.name)).toEqual(['a', 'b']);
});
