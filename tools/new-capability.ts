// Scaffold evidence, not implementation. Never promote the parity status.
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
import { compile } from '@anima-format/markup';
import type { Manifest } from './modules.ts';
import { execFileSync } from 'node:child_process';
import { outputs, type Row } from './parity.ts';

const repo = fileURLToPath(new URL('../', import.meta.url));
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export async function scaffold(root: string, id: string, moduleName?: string): Promise<string[]> {
  const inventory = 'docs/parity/inventory.json';
  const rows: Row[] = JSON.parse(readFileSync(resolve(root, inventory), 'utf8'));
  const row = rows.find((r) => r.id === id);
  if (!row) throw Error(`Unknown parity row: ${id}`);
  if (row.anima.status === 'done')
    throw Error(`${id}: already done; refusing to replace completion evidence`);
  const name = moduleName ?? row.anima.module;
  if (!/^[a-z][a-z0-9]*$/.test(name))
    throw Error(
      'Module name must start with a lower-case letter and contain only lower-case letters or digits',
    );
  const caseName = slug(id);
  if (!caseName) throw Error('Row id must contain letters or digits');
  const base = `modules/${name}`;
  const cap = `${base}/capabilities/${caseName}`;
  const spec = 'spec/SPEC.md';
  const conformance = `spec/conformance/${caseName}`;
  const oracle = `tests/oracle/${caseName}`;
  const changed: string[] = [];
  const put = async (path: string, source: string, replace = false) => {
    const target = resolve(root, path);
    if (existsSync(target) && !replace) return; // preserve coder edits
    const text =
      /\.(ts|json)$/.test(path) && path !== 'docs/parity/matrix.json'
        ? await format(source, {
            parser: path.endsWith('.ts') ? 'typescript' : 'json',
            singleQuote: true,
            printWidth: 100,
          })
        : source;
    if (existsSync(target) && readFileSync(target, 'utf8') === text) return;
    changed.push(path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  };
  if (!existsSync(resolve(root, base, 'manifest.ts'))) {
    const manifest: Manifest = {
      name,
      after: [],
      core: { entry: 'core/index.ts', export: name, svg: 'core/svg.ts', svgExport: `${name}SVG` },
      web: [{ name, budget: 5120 }],
      adapters: {
        [`packages/core/src/modules/${name}/index.ts`]: 'core/index.ts',
        [`packages/core/src/modules/${name}/svg.ts`]: 'core/svg.ts',
        [`packages/markup/src/${name}.ts`]: 'markup/index.ts',
        [`packages/web/src/${name}.ts`]: 'web/index.ts',
      },
      exports: {
        [`core:./${name}`]: `packages/core/src/modules/${name}/index.ts`,
        [`markup:./${name}`]: `packages/markup/src/${name}.ts`,
        [`web:./${name}`]: `packages/web/src/${name}.ts`,
      },
      tests: [
        `${base}/test/**/*.test.ts`,
        'packages/markup/test/corpus.test.ts',
        'packages/markup/test/names.test.ts',
      ],
      conformance: [caseName],
      docs: [spec],
    };
    await put(
      `${base}/manifest.ts`,
      `// TODO: review dependencies and measured budget before implementation.\nexport const after: string[] = [];\nexport default { ...${JSON.stringify(manifest)}, after };\n`,
    );
    await put(
      `${base}/core/index.ts`,
      `import type { Module } from '../../../packages/core/src/modules.ts';\nimport { after } from '../manifest.ts';\n// TODO: compose capability registry entries and pure hooks here.\nexport const ${name}: Module = { name: '${name}', after, entries: [] };\n`,
    );
    await put(
      `${base}/core/svg.ts`,
      `import type { SVGBackend } from '../../../packages/core/src/svg.ts';\n// TODO: SVG backend only; keep drawing data renderer-neutral.\nexport const ${name}SVG: SVGBackend = {};\n`,
    );
    await put(
      `${base}/markup/index.ts`,
      '// TODO: prefer registry descriptors; add a manifest markupHook only if needed.\nexport {};\n',
    );
    await put(
      `${base}/web/index.ts`,
      `import { ${name} } from '../core/index.ts';\nimport { ${name}SVG } from '../core/svg.ts';\nimport '../../../packages/web/src/index.ts';\nimport type { AnimaIcon } from '../../../packages/web/src/index.ts';\n(customElements.get('anima-icon') as typeof AnimaIcon).registerModule(${name});\n(customElements.get('anima-icon') as typeof AnimaIcon).registerSVGBackend('${name}', ${name}SVG);\n`,
    );
  }
  const manifestPath = `${base}/manifest.ts`;
  const manifestSource = readFileSync(resolve(root, manifestPath), 'utf8');
  const prefixes = manifestSource.match(/conformance:\s*\[([\s\S]*?)\]/);
  if (!prefixes) throw Error(`${manifestPath}: cannot locate conformance array`);
  if (!prefixes[1]!.includes(caseName)) {
    const previous = prefixes[1]!.trim().replace(/,$/, '');
    await put(
      manifestPath,
      manifestSource.replace(
        prefixes[0],
        `conformance: [${previous}${previous ? ',' : ''} '${caseName}']`,
      ),
      true,
    );
  }
  const currentSpec = readFileSync(resolve(root, spec), 'utf8');
  const marker = `<!-- capability: ${id} -->`;
  if (!currentSpec.includes(marker)) {
    const chapter = `## ${name}`;
    const stub = `\n${marker}\n### ${row.capability}\n\nTODO: ${row.what}\n\nTODO: define JSON and AniML spellings, validation diagnostics (code, JSON pointer, message, hint),\nresolution order, deterministic sampling, CLI/schema support and oracle equivalence/limits.\n`;
    const start = currentSpec.split('\n').findIndex((line) => line === chapter);
    const lines = currentSpec.split('\n');
    const end = start < 0 ? -1 : lines.findIndex((line, i) => i > start && /^## /.test(line));
    if (start < 0) await put(spec, currentSpec.trimEnd() + `\n\n${chapter}\n` + stub, true);
    else {
      lines.splice(end < 0 ? lines.length : end, 0, stub);
      await put(spec, lines.join('\n'), true);
    }
  }
  await put(
    `${cap}/registry.ts`,
    `import type { ModuleEntry } from '../../../../packages/core/src/modules.ts';\n// TODO: fill and compose these into ${base}/core/index.ts. No placeholder key is registered.\n// { target: 'TODO', shapes: { jsonName: { k: 'num', markup: 'svg-name' } } }\n// TODO: JSON name and markup name (SVG spelling where one exists), feature: '${name}'.\nexport const entries: ModuleEntry[] = [];\n`,
  );
  await put(
    `${base}/test/core/${caseName}.test.ts`,
    `import { it } from 'vitest';\n// TODO: use invalid/${caseName}/ documents; assert code, pointer, message and hint.\nit.todo(${JSON.stringify(`${id}: diagnostic and both syntax spellings`)});\n`,
  );
  await put(
    `${base}/test/core/invalid/${caseName}/README.md`,
    `TODO: minimal invalid .ani/.animl documents for ${id}; include expected diagnostic code, pointer, message and hint.\n`,
  );
  const pending = json({
    status: 'todo',
    reason: `${id}: implement the capability and independent expected evidence`,
  });
  const animl = `<!-- TODO: ${id}; replace this baseline scene with a capability probe. -->\n<anima version="0.1" name="${caseName}" grid="20">\n  <circle id="probe" cx="10" cy="10" r="1" fill="#000"/>\n</anima>\n`;
  await put(`${conformance}/todo.json`, pending);
  await put(`${conformance}/case.animl`, animl);
  await put(`${conformance}/script.txt`, '# TODO: inputs, step boundaries and snapshots\n');
  await put(`${conformance}/expected.jsonl`, '');
  const checklist = resolve(root, cap, 'README.md');
  const noCounterpart =
    (existsSync(checklist) && readFileSync(checklist, 'utf8').includes('oracle skipped:')) ||
    row.anima.status === 'wont-do' ||
    /no (?:faithful |direct )?(?:counterpart|equivalent)|not faithfully|no .*counterpart/i.test(
      `${row.anima.construct} ${row.anima.reason ?? ''}`,
    );
  if (!noCounterpart) {
    await put(`${oracle}/todo.json`, pending);
    await put(`${oracle}/case.animl`, animl);
    await put(
      `${oracle}/rive/README.md`,
      'TODO: independently author a Rive scene and capture reference PNGs; do not read/convert .riv files.\n',
    );
  }
  await put(`${cap}/example.animl`, animl);
  const example = compile(animl);
  if (!example.text || example.diagnostics.length)
    throw Error('Internal error: invalid example stub');
  await put(`${cap}/example.ani`, example.text);
  await put(
    `${cap}/README.md`,
    `# ${row.capability}\n\nPending scaffold for ${id}; no implementation or parity completion is claimed.\n\n- TODO: spec/SPEC.md subsection, registry.ts entries and both spellings; compose entries into core.\n- TODO: diagnostics and invalid documents, deterministic conformance expectations.\n- TODO: replace example.animl and rebuild example.ani through the compiler.\n- TODO: CLI validate/schema/inspect/sample coverage, generated schema and measured manifest size budget.\n- TODO: ${noCounterpart ? `oracle skipped: ${row.anima.reason ?? row.anima.construct}` : 'independent oracle scene/frames; add to tests/oracle/cases.json only when complete.'}\n\nRemove todo.json only after completing the probe and its independently checked expected output.\nFollow spec/MODULES.md §5 and docs/research/rive-web-runtime.md comparison cautions.\n`,
  );
  row.anima.construct = `TODO: ${cap}/registry.ts; ${spec} (${row.capability}); ${cap}/example.animl`;
  row.anima.test = `TODO: ${base}/test/core/${caseName}.test.ts; ${conformance}; ${noCounterpart ? 'oracle skipped (see capability README)' : oracle}`;
  await put(inventory, json(rows), true);
  for (const [path, text] of Object.entries(outputs(rows)))
    await put(`docs/parity/${path}`, text, true);
  // A fresh generator process sees manifest edits even across multiple calls in one session.
  const wiring = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { generate } from ${JSON.stringify(new URL('./modules.ts', import.meta.url).href)}; console.log(JSON.stringify(await generate(${JSON.stringify(root)})));`,
    ],
    { encoding: 'utf8' },
  );
  changed.push(...JSON.parse(wiring));
  return changed.sort();
}

export async function dryRun(root: string, id: string, moduleName?: string) {
  const scratch = mkdtempSync(resolve(tmpdir(), 'anima-capability-plan-'));
  try {
    for (const path of ['modules', 'packages', 'spec', 'docs', 'tools', 'tests'])
      cpSync(resolve(root, path), resolve(scratch, path), {
        recursive: true,
        filter: (p) => !p.includes('/node_modules') && !p.includes('/dist'),
      });
    return await scaffold(scratch, id, moduleName);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
      console.log('Usage: node tools/new-capability.ts <row-id> [--module <name>] [--dry-run]');
      process.exit(0);
    }
    const id = args.shift();
    let name: string | undefined;
    let dry = false;
    while (args.length) {
      const arg = args.shift();
      if (arg === '--dry-run') dry = true;
      else if (arg === '--module' && args[0] && !args[0].startsWith('-')) name = args.shift();
      else throw Error(`Unknown or incomplete option: ${arg}`);
    }
    if (!id)
      throw Error('Usage: node tools/new-capability.ts <row-id> [--module <name>] [--dry-run]');
    const files = await (dry ? dryRun(repo, id, name) : scaffold(repo, id, name));
    console.log(
      `${dry ? 'Would update' : 'Updated'} ${files.length} files (TODO skeletons; parity status unchanged)`,
    );
    for (const file of files) console.log(file);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
