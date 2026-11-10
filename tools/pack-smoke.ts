import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const DIST = resolve(ROOT, 'dist-npm');
const VERSION = (
  JSON.parse(readFileSync(resolve(DIST, 'animl/package.json'), 'utf8')) as { version: string }
).version;
const ANIML_TGZ = resolve(DIST, `animl-${VERSION}.tgz`);
const CLI_TGZ = resolve(DIST, `animl-cli-${VERSION}.tgz`);
const TEMP = mkdtempSync(join(tmpdir(), 'anima-pack-smoke-'));
const rows: { check: string; ok: boolean; detail: string }[] = [];

function command(command: string, args: string[], cwd = TEMP): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} exited ${result.status}\n${result.stdout ?? ''}${result.stderr ?? ''}`,
    );
  }
  return String(result.stdout ?? '');
}

const anima = (...args: string[]) => command('npx', ['--no-install', 'anima', ...args]);

async function check(
  name: string,
  fn: () => string | undefined | Promise<string | undefined>,
): Promise<void> {
  try {
    const detail = await fn();
    rows.push({
      check: name,
      ok: true,
      detail: String(detail ?? 'ok')
        .replace(/\s+/g, ' ')
        .trim(),
    });
  } catch (error) {
    rows.push({
      check: name,
      ok: false,
      detail: (error as Error).message.replace(/\s+/g, ' ').trim().slice(0, 240),
    });
  }
}

function stageSize(path: string): number {
  let total = 0;
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = resolve(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) total += statSync(file).size;
    }
  };
  visit(path);
  return total;
}

function tarEntries(tarball: string): string[] {
  return command('tar', ['-tzf', tarball], ROOT).trim().split(/\r?\n/).filter(Boolean);
}

function contentCheck(tarball: string, stage: string): string {
  const entries = tarEntries(tarball);
  const badTs = entries.filter((path) => path.endsWith('.ts') && !path.endsWith('.d.ts'));
  const tests = entries.filter(
    (path) => /(^|\/)(?:test|tests)(\/|$)/.test(path) || /\.(?:test|spec)\.[^.]+$/.test(path),
  );
  const riv = entries.filter((path) => path.endsWith('.riv'));
  const nodeModules = entries.filter((path) => path.includes('/node_modules/'));
  const failures = [
    badTs.length ? `TypeScript source: ${badTs.slice(0, 3).join(', ')}` : '',
    tests.length ? `tests: ${tests.slice(0, 3).join(', ')}` : '',
    riv.length ? `.riv: ${riv.slice(0, 3).join(', ')}` : '',
    nodeModules.length ? `node_modules: ${nodeModules.slice(0, 3).join(', ')}` : '',
  ].filter(Boolean);
  if (failures.length) throw new Error(failures.join('; '));
  return `${entries.length} files; ${statSync(tarball).size} B packed; ${stageSize(stage)} B unpacked`;
}

function copyReferenceScene(): void {
  cpSync(resolve(ROOT, 'examples/bell.animl'), resolve(TEMP, 'bell.animl'));
  cpSync(resolve(ROOT, 'examples/lib'), resolve(TEMP, 'lib'), { recursive: true });
}

async function nodeImportCheck(): Promise<string> {
  const script = `
import fs from 'node:fs';
import path from 'node:path';
import 'animl/all';
import { load, Player } from 'animl';
import { compile } from 'animl/markup';
const source = fs.readFileSync('bell.animl', 'utf8');
const compiled = compile(source, {
  file: 'bell.animl',
  resolve: (name) => fs.readFileSync(path.resolve(name), 'utf8'),
});
if (!compiled.text || compiled.diagnostics.some((d) => d.severity === 'error')) {
  throw new Error(JSON.stringify(compiled.diagnostics));
}
const loaded = load(compiled.text);
if (!loaded.model) throw new Error(JSON.stringify(loaded.diagnostics));
const player = new Player(loaded.model);
player.step(0);
const values = player.values();
if (!values || !Object.keys(values).length) throw new Error('values() returned no resolved values');
console.log(Object.keys(values).length);
`;
  writeFileSync(resolve(TEMP, 'node-smoke.mjs'), script);
  return command(process.execPath, ['node-smoke.mjs']).trim() + ' values';
}

async function browserCheck(): Promise<string> {
  const entry = resolve(TEMP, 'browser-entry.js');
  const bundle = resolve(TEMP, 'browser-runtime.js');
  writeFileSync(entry, `import 'animl/web';\n`);
  await build({
    absWorkingDir: TEMP,
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    outfile: bundle,
  });
  const runtime = readFileSync(bundle, 'utf8').replace(/<\/script/gi, '<\\/script');
  const bell = readFileSync(resolve(ROOT, 'examples/bell.ani'), 'utf8').replace(
    /<\/script/gi,
    '<\\/script',
  );
  const executablePath =
    process.env.CHROMIUM_PATH ??
    resolve(
      process.env.HOME ?? '',
      '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
    );
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 120, height: 120 } });
    await page.setContent(
      `<!doctype html><style>body{margin:0;background:white}anima-icon{display:block;width:100px;height:100px;color:black}</style><anima-icon id="icon"><script type="application/vnd.anima+json">${bell}</script></anima-icon><script type="module">${runtime}</script>`,
    );
    await page.waitForFunction(() => {
      const el = document.querySelector('anima-icon');
      const ctor = customElements.get('anima-icon');
      return !!ctor && !!el && el instanceof ctor && !!el.shadowRoot?.querySelector('svg');
    });
    const upgraded = await page.evaluate(() => {
      const el = document.querySelector('anima-icon')!;
      const ctor = customElements.get('anima-icon');
      return !!ctor && el instanceof ctor;
    });
    if (!upgraded) throw new Error('<anima-icon> was not upgraded');
    const shot = await page.screenshot();
    const png = PNG.sync.read(shot);
    let nonBlank = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      const r = png.data[i]!,
        g = png.data[i + 1]!,
        b = png.data[i + 2]!,
        a = png.data[i + 3]!;
      if (a > 0 && (r < 245 || g < 245 || b < 245)) nonBlank++;
    }
    if (nonBlank < 20) throw new Error(`render was blank (${nonBlank} non-white pixels)`);
    return `${nonBlank} non-white pixels`;
  } finally {
    await browser.close();
  }
}

function printTable(): void {
  const width = Math.max('check'.length, ...rows.map((row) => row.check.length));
  console.log(`${'check'.padEnd(width)}  status  detail`);
  for (const row of rows) {
    console.log(`${row.check.padEnd(width)}  ${row.ok ? 'PASS  ' : 'FAIL  '}  ${row.detail}`);
  }
}

async function main(): Promise<void> {
  if (!existsSync(ANIML_TGZ) || !existsSync(CLI_TGZ)) {
    throw new Error('missing dist-npm tarballs; run node tools/pack.ts first');
  }
  await check('animl tarball', () => contentCheck(ANIML_TGZ, resolve(DIST, 'animl')));
  await check('animl-cli tarball', () => contentCheck(CLI_TGZ, resolve(DIST, 'animl-cli')));
  await check(
    'npm init',
    () => command('npm', ['init', '-y']).trim().split(/\r?\n/).at(-1) ?? 'ok',
  );
  await check(
    'npm install',
    () => command('npm', ['install', ANIML_TGZ, CLI_TGZ]).trim().split(/\r?\n/).at(-1) ?? 'ok',
  );
  copyReferenceScene();
  await check('anima --version', () => {
    const version = anima('--version').trim();
    if (version !== VERSION) throw new Error(`expected ${VERSION}, got ${version}`);
    return version;
  });
  await check('animl-cli bin', () => {
    // `npx animl-cli …` must run this package's CLI (the npm package `anima` is unrelated).
    const version = command('npx', ['--no-install', 'animl-cli', 'version']).trim();
    if (version !== VERSION) throw new Error(`expected ${VERSION}, got ${version}`);
    return version;
  });
  await check(
    'validate',
    () => anima('validate', 'bell.animl').trim().split(/\r?\n/).at(-1) ?? 'ok',
  );
  await check('render png', () => {
    anima('render', 'bell.animl', '-o', 'out.png');
    const size = statSync(resolve(TEMP, 'out.png')).size;
    if (!size) throw new Error('out.png is empty');
    return `${size} B`;
  });
  await check('sample snapshot', () => {
    const output = anima('sample', 'bell.animl', '-e', 'snapshot').trim();
    if (!output) throw new Error('no snapshot output');
    return output.split(/\r?\n/).at(-1)!;
  });
  await check('search hover', () => anima('search', 'hover').trim().split(/\r?\n/)[0] ?? 'ok');
  await check('features ik', () => anima('features', 'ik').trim().split(/\r?\n/)[0] ?? 'ok');
  await check('docs ik', () => anima('docs', 'ik').trim().split(/\r?\n/)[0] ?? 'ok');
  await check('schema rect', () => anima('schema', 'rect').trim().split(/\r?\n/)[0] ?? 'ok');
  await check('examples bell --print', () => {
    const text = anima('examples', 'bell', '--print');
    if (!text.includes('<anima')) throw new Error('printed example is not AniML');
    return `${text.length} chars`;
  });
  await check('help --json', () => {
    const parsed = JSON.parse(anima('help', '--json')) as unknown;
    if (!parsed || typeof parsed !== 'object') throw new Error('invalid help JSON');
    return 'valid JSON';
  });
  await check('new --sample bell', () => {
    anima('new', 'sample-project', '--sample', 'bell');
    if (!existsSync(resolve(TEMP, 'sample-project/main.animl')))
      throw new Error('main.animl missing');
    return 'sample-project/main.animl';
  });
  await check('bundle paint,bind', () => {
    anima('bundle', '--modules', 'paint,bind', '-o', 'b.js');
    const size = statSync(resolve(TEMP, 'b.js')).size;
    if (!size) throw new Error('b.js is empty');
    return `${size} B`;
  });
  await check('Node ESM imports', nodeImportCheck);
  await check('browser animl/web', browserCheck);
  printTable();
  if (rows.some((row) => !row.ok)) {
    console.error(`smoke workspace retained: ${TEMP}`);
    process.exitCode = 1;
  } else {
    rmSync(TEMP, { recursive: true, force: true });
  }
}

await main();
