import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import ts from 'typescript';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const DIST = resolve(ROOT, 'dist-npm');
const ANIML = resolve(DIST, 'animl');
const CLI = resolve(DIST, 'animl-cli');
const DECL = resolve(DIST, '.declarations');
const VERSION = '0.1.0';

const slash = (path: string) => path.replaceAll('\\', '/');
const repoPath = (path: string) => slash(relative(ROOT, path));
const readJSON = <T>(path: string): T => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T;

function walk(dir: string, accept: (path: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path, accept));
    else if (entry.isFile() && accept(path)) out.push(path);
  }
  return out;
}

const tsFiles = (dir: string) =>
  walk(dir, (path) => path.endsWith('.ts') && !path.endsWith('.d.ts'));

function localImport(from: string, specifier: string): string | undefined {
  if (!specifier.startsWith('.')) return undefined;
  const direct = resolve(dirname(from), specifier);
  for (const candidate of [direct, direct + '.ts', resolve(direct, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile() && candidate.endsWith('.ts')) {
      return candidate;
    }
  }
  return undefined;
}

function imports(path: string): string[] {
  const text = readFileSync(path, 'utf8');
  const found: string[] = [];
  const pattern = /\b(?:from\s*|import\s*(?:\(\s*)?)(['"])([^'"]+)\1/g;
  for (const match of text.matchAll(pattern)) found.push(match[2]!);
  return found;
}

function addClosure(files: Set<string>, seeds: Iterable<string>): void {
  const queue = [...seeds];
  while (queue.length) {
    const file = queue.pop()!;
    if (files.has(file)) continue;
    files.add(file);
    for (const specifier of imports(file)) {
      const target = localImport(file, specifier);
      if (!target) continue;
      const rel = repoPath(target);
      if (/(^|\/)test(s)?\//.test(rel) || /\.(?:test|spec)\.ts$/.test(rel)) continue;
      queue.push(target);
    }
  }
}

function runtimeSources(cliSources: string[]): string[] {
  const seeds = [
    ...tsFiles(resolve(ROOT, 'packages/core/src')),
    ...tsFiles(resolve(ROOT, 'packages/markup/src')),
    ...tsFiles(resolve(ROOT, 'packages/web/src')),
  ];
  for (const module of readdirSync(resolve(ROOT, 'modules'), { withFileTypes: true })) {
    if (!module.isDirectory()) continue;
    for (const part of ['core', 'markup', 'web']) {
      seeds.push(...tsFiles(resolve(ROOT, 'modules', module.name, part)));
    }
  }
  for (const source of cliSources) {
    for (const specifier of imports(source)) {
      const target = localImport(source, specifier);
      if (target && !repoPath(target).startsWith('packages/cli/')) seeds.push(target);
    }
  }
  const files = new Set<string>();
  addClosure(files, seeds);
  if (files.has(resolve(ROOT, 'tools/build-playground.ts'))) {
    addClosure(files, tsFiles(resolve(ROOT, 'packages/playground/src')));
  }
  return [...files].sort();
}

function packageSpecifier(specifier: string): string {
  const mappings = [
    ['@anima-format/core', 'animl'],
    ['@anima-format/markup', 'animl/markup'],
    ['@anima-format/web', 'animl/web'],
  ] as const;
  for (const [from, to] of mappings) {
    if (specifier === from) return to;
    if (specifier.startsWith(from + '/')) return to + specifier.slice(from.length);
  }
  return specifier;
}

function rewriteSpecifier(source: string, specifier: string, mode: 'runtime' | 'cli'): string {
  const packaged = packageSpecifier(specifier);
  if (packaged !== specifier) return packaged;
  if (!specifier.startsWith('.')) return specifier;
  const target = localImport(source, specifier);
  if (mode === 'cli' && target && !repoPath(target).startsWith('packages/cli/')) {
    return `animl/internal/${repoPath(target).replace(/\.ts$/, '.js')}`;
  }
  return specifier.replace(/\.ts$/, '.js');
}

function rewriteImports(code: string, source: string, mode: 'runtime' | 'cli'): string {
  const pattern = /(\b(?:from\s*|import\s*(?:\(\s*)?))(['"])([^'"]+)\2/g;
  let output = code.replace(pattern, (_whole, prefix: string, quote: string, specifier: string) => {
    return `${prefix}${quote}${rewriteSpecifier(source, specifier, mode)}${quote}`;
  });
  if (mode === 'runtime') {
    output = output.replace(
      /new URL\((['"])([^'"]+)\.ts\1/g,
      (_whole, quote: string, name: string) => `new URL(${quote}${name}.js${quote}`,
    );
  }
  return output;
}

async function emitJavaScript(
  source: string,
  stage: string,
  mode: 'runtime' | 'cli',
): Promise<void> {
  const rel = repoPath(source).replace(/\.ts$/, '.js');
  const target = resolve(stage, rel);
  mkdirSync(dirname(target), { recursive: true });
  const result = await transform(readFileSync(source, 'utf8'), {
    loader: 'ts',
    format: 'esm',
    target: 'es2022',
    sourcefile: repoPath(source),
    legalComments: 'none',
  });
  let code = rewriteImports(result.code, source, mode);
  if (rel === 'packages/cli/src/main.js' && !code.startsWith('#!')) {
    code = '#!/usr/bin/env node\n' + code;
  }
  writeFileSync(target, code);
}

function emitDeclarations(sources: string[]): void {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    baseUrl: ROOT,
    ignoreDeprecations: '6.0',
    paths: {
      '@anima-format/core': ['packages/core/src/index.ts'],
      '@anima-format/core/*': ['packages/core/src/*'],
      '@anima-format/markup': ['packages/markup/src/index.ts'],
      '@anima-format/markup/*': ['packages/markup/src/*'],
      '@anima-format/web': ['packages/web/src/index.ts'],
      '@anima-format/web/*': ['packages/web/src/*'],
    },
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    types: ['node'],
    strict: true,
    noImplicitOverride: true,
    noFallthroughCasesInSwitch: true,
    verbatimModuleSyntax: true,
    erasableSyntaxOnly: true,
    allowImportingTsExtensions: true,
    rewriteRelativeImportExtensions: true,
    isolatedModules: true,
    skipLibCheck: true,
    declaration: true,
    emitDeclarationOnly: true,
    declarationMap: false,
    noEmit: false,
    rootDir: ROOT,
    outDir: DECL,
  };
  const program = ts.createProgram(sources, options);
  const result = program.emit();
  const diagnostics = ts.getPreEmitDiagnostics(program).concat(result.diagnostics);
  const errors = diagnostics.filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (errors.length) {
    const host: ts.FormatDiagnosticsHost = {
      getCanonicalFileName: (file) => file,
      getCurrentDirectory: () => ROOT,
      getNewLine: () => '\n',
    };
    throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, host));
  }
}

function copyDeclarations(sources: string[], stage: string, mode: 'runtime' | 'cli'): void {
  for (const source of sources) {
    const rel = repoPath(source).replace(/\.ts$/, '.d.ts');
    const emitted = resolve(DECL, rel);
    if (!existsSync(emitted)) continue;
    const target = resolve(stage, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, rewriteImports(readFileSync(emitted, 'utf8'), source, mode));
  }
}

function copyFile(rel: string, stage: string, targetRel = rel): void {
  const source = resolve(ROOT, rel);
  if (!existsSync(source) || !statSync(source).isFile()) return;
  const target = resolve(stage, targetRel);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target);
}

function copyTree(sourceRel: string, stage: string, accept: (rel: string) => boolean): void {
  const source = resolve(ROOT, sourceRel);
  for (const file of walk(source, () => true)) {
    const rel = repoPath(file);
    if (accept(rel)) copyFile(rel, stage);
  }
}

function packageExports(): Record<string, { types: string; default: string }> {
  type Package = { exports: Record<string, string> };
  const core = readJSON<Package>('packages/core/package.json');
  const markup = readJSON<Package>('packages/markup/package.json');
  const web = readJSON<Package>('packages/web/package.json');
  const out: Record<string, { types: string; default: string }> = {};
  const add = (pkg: string, prefix: string, entries: Record<string, string>) => {
    for (const [key, target] of Object.entries(entries)) {
      const suffix = key === '.' ? '' : key.slice(1);
      const publicKey = prefix ? prefix + suffix : key;
      const base = `./packages/${pkg}/${target.replace(/^\.\//, '')}`;
      out[publicKey] = {
        types: base.replace(/\.ts$/, '.d.ts'),
        default: base.replace(/\.ts$/, '.js'),
      };
    }
  };
  add('core', '', core.exports);
  add('markup', './markup', markup.exports);
  add('web', './web', web.exports);
  out['./internal/*.js'] = { types: './*.d.ts', default: './*.js' };
  out['./internal/*'] = { types: './*.d.ts', default: './*.js' };
  const dist = resolve(ROOT, 'packages/web/dist');
  for (const file of readdirSync(dist).filter((name) => /^anima-.+\.js$/.test(name))) {
    const name = file.slice('anima-'.length, -'.js'.length);
    const entry = name === 'icon' ? 'index' : name;
    out[`./browser/${name}`] = {
      types: `./packages/web/src/${entry}.d.ts`,
      default: `./packages/web/dist/${file}`,
    };
  }
  out['./browser/*'] = {
    types: './packages/web/src/*.d.ts',
    default: './packages/web/dist/anima-*.js',
  };
  return out;
}

const animlReadme = `# animl

Anima's dependency-free runtime, AniML compiler, web component, and optional modules.

Install:

\`\`\`sh
npm install animl
\`\`\`

Browser:

\`\`\`html
<script type="module">
  import 'animl/web';
</script>
<anima-icon id="bell" style="width:48px;height:48px">
  <script type="application/vnd.anima+json">
    {"anima":"0.1","name":"dot","grid":20,"viewBox":[0,0,20,20],
     "nodes":[{"type":"circle","id":"dot","cx":10,"cy":10,"r":7,
     "fill":{"color":"currentColor"}}]}
  </script>
</anima-icon>
<script type="module">
  const bell = document.querySelector('#bell');
  await customElements.whenDefined('anima-icon');
  bell.style.color = 'tomato';
</script>
\`\`\`

Node:

\`\`\`js
import 'animl/all';
import { load, Player } from 'animl';
import { compile } from 'animl/markup';
const source = '<anima version="0.1" name="dot" grid="20" viewBox="0 0 20 20">' +
  '<circle id="dot" cx="10" cy="10" r="7" fill="#000"/></anima>';
const built = compile(source);
if (built.diagnostics.some(d => d.severity === 'error')) {
  throw new Error(JSON.stringify(built.diagnostics));
}
const result = load(built.text);
if (!result.model) throw new Error(JSON.stringify(result.diagnostics));
const player = new Player(result.model);
player.step(0);
console.log(player.values());
\`\`\`

Prebuilt script-tag/CDN bundles are exported under \`animl/browser/*\`.
Documentation: https://github.com/MRoiban/anima/tree/main/docs
`;

const cliReadme = `# animl-cli

The \`anima\` command-line tool for authoring, validating, rendering, discovering, and bundling Anima files.

\`\`\`sh
npm install -g animl-cli
anima --version
anima search hover
anima features ik
anima examples bell
anima docs ik
anima schema rect
anima help --json
\`\`\`

CLI documentation: https://github.com/MRoiban/anima/blob/main/docs/CLI.md
`;

function writeJSON(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

function stageAniml(runtime: string[]): void {
  type RootPackage = { engines?: Record<string, string> };
  const root = readJSON<RootPackage>('package.json');
  const packageJSON = {
    name: 'animl',
    version: VERSION,
    description: 'Anima runtime, AniML compiler, web component, and optional modules.',
    license: 'MIT',
    type: 'module',
    repository: { type: 'git', url: 'git+https://github.com/MRoiban/anima.git' },
    engines: root.engines,
    exports: packageExports(),
    files: ['packages', 'modules', 'tools', 'README.md', 'LICENSE', 'NOTICE'],
  };
  writeJSON(resolve(ANIML, 'package.json'), packageJSON);
  writeFileSync(resolve(ANIML, 'README.md'), animlReadme);
  for (const file of ['LICENSE', 'NOTICE']) copyFile(file, ANIML);
  for (const file of walk(resolve(ROOT, 'packages/web/dist'), (path) => path.endsWith('.js'))) {
    copyFile(repoPath(file), ANIML);
  }
  for (const file of ['packages/playground/src/page.html', 'packages/playground/src/style.css']) {
    copyFile(file, ANIML);
  }
  void runtime;
}

function stageCliData(): void {
  for (const file of [
    'docs/AUTHORING.md',
    'docs/MARKUP.md',
    'docs/CLI.md',
    'docs/parity/inventory.json',
    'spec/SPEC.md',
    'spec/ANIML.md',
    'spec/MODULES.md',
    'packages/cli/src/font/README.md',
  ])
    copyFile(file, CLI);

  const safeData = (rel: string) =>
    !rel.endsWith('.ts') &&
    !rel.endsWith('.riv') &&
    !/(^|\/)node_modules\//.test(rel) &&
    !/(^|\/)test(s)?\//.test(rel);
  copyTree('examples', CLI, safeData);
  copyTree('fixtures/bell/rive-reference/frames', CLI, safeData);

  for (const module of readdirSync(resolve(ROOT, 'modules'), { withFileTypes: true })) {
    if (!module.isDirectory()) continue;
    const base = `modules/${module.name}`;
    for (const doc of ['SPEC.md', 'AUTHORING.md']) copyFile(`${base}/${doc}`, CLI);
    copyTree(`${base}/examples`, CLI, safeData);
    copyTree(
      `${base}/capabilities`,
      CLI,
      (rel) => safeData(rel) && /example\.(?:animl|ani)$/.test(rel),
    );
    copyFile(`${base}/manifest.ts`, CLI, `${base}/manifest.source`);
    copyFile(`${base}/core/commands.ts`, CLI, `${base}/core/commands.source`);
  }
  for (const file of [
    'modules/input/core/types.ts',
    'modules/bind/core/expression.ts',
    'modules/convert/core/math.ts',
    'packages/core/src/script.ts',
  ])
    copyFile(file, CLI, file.replace(/\.ts$/, '.source'));
}

function stageCli(): void {
  type Package = { dependencies?: Record<string, string> };
  type Root = { devDependencies?: Record<string, string>; engines?: Record<string, string> };
  const current = readJSON<Package>('packages/cli/package.json');
  const root = readJSON<Root>('package.json');
  const dependencies = Object.fromEntries(
    Object.entries(current.dependencies ?? {}).filter(
      ([name]) => !name.startsWith('@anima-format/'),
    ),
  );
  dependencies.animl = VERSION;
  for (const name of ['playwright-core', 'pngjs']) {
    if (root.devDependencies?.[name]) dependencies[name] = root.devDependencies[name];
  }
  const packageJSON = {
    name: 'animl-cli',
    version: VERSION,
    description: 'The anima command-line tool for Anima and AniML.',
    license: 'MIT',
    type: 'module',
    repository: { type: 'git', url: 'git+https://github.com/MRoiban/anima.git' },
    engines: root.engines,
    bin: { anima: 'packages/cli/src/main.js' },
    exports: {
      '.': {
        types: './packages/cli/src/index.d.ts',
        default: './packages/cli/src/index.js',
      },
    },
    dependencies,
    files: [
      'packages',
      'modules',
      'docs',
      'spec',
      'examples',
      'fixtures',
      'llms.txt',
      'README.md',
      'LICENSE',
      'NOTICE',
    ],
  };
  writeJSON(resolve(CLI, 'package.json'), packageJSON);
  writeJSON(resolve(CLI, 'packages/cli/package.json'), { version: VERSION, type: 'module' });
  writeFileSync(resolve(CLI, 'README.md'), cliReadme);
  copyFile('packages/cli/llms.txt', CLI, 'llms.txt');
  for (const file of ['LICENSE', 'NOTICE']) copyFile(file, CLI);
  stageCliData();
}

function run(command: string, args: string[], cwd = ROOT): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status})\n${result.stdout ?? ''}${result.stderr ?? ''}`,
    );
  }
  return String(result.stdout ?? '');
}

function pack(stage: string): void {
  const output = run('npm', ['pack', '--json', '--pack-destination', DIST], stage);
  const result = JSON.parse(output) as { filename: string; size: number; unpackedSize: number }[];
  const item = result[0]!;
  console.log(`${item.filename}: ${item.size} B packed, ${item.unpackedSize} B unpacked`);
}

async function main(): Promise<void> {
  run(process.execPath, ['tools/build-web.ts']);
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(ANIML, { recursive: true });
  mkdirSync(CLI, { recursive: true });
  mkdirSync(DECL, { recursive: true });

  const cli = tsFiles(resolve(ROOT, 'packages/cli/src')).sort();
  const runtime = runtimeSources(cli);
  for (const source of runtime) await emitJavaScript(source, ANIML, 'runtime');
  for (const source of cli) await emitJavaScript(source, CLI, 'cli');

  emitDeclarations([...new Set([...runtime, ...cli])]);
  copyDeclarations(runtime, ANIML, 'runtime');
  copyDeclarations(cli, CLI, 'cli');
  stageAniml(runtime);
  stageCli();
  rmSync(DECL, { recursive: true, force: true });

  pack(ANIML);
  pack(CLI);
}

await main();
