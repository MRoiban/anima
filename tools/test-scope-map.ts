import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

export const packages = ['core', 'markup', 'web', 'cli', 'playground'];
export const conformanceRunner = 'packages/core/test/conformance.test.ts';
export const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  );
export const testFiles = () =>
  [...filesUnder('packages'), ...filesUnder('tools')].filter((f) => f.endsWith('.test.ts'));
export const isBrowser = (file: string) =>
  /from ['"]playwright-core['"]/.test(readFileSync(file, 'utf8'));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const named = (file: string, name: string) =>
  new RegExp(`(^|[/.\\-])${escape(name)}([/.\\-]|$)`).test(file);
const references = (file: string, name: string) =>
  named(file, name) ||
  new RegExp(`(^|[^a-zA-Z0-9_])${escape(name)}($|[^a-zA-Z0-9_])`).test(readFileSync(file, 'utf8'));

/** Ownership seam: replace discovery here with module manifests when D1 lands. */
export function moduleFiles(name: string, all = testFiles()) {
  const files = all.filter((f) => {
    if (f === conformanceRunner) return false;
    // Registry/corpus integration tests exercise every registered module without naming it.
    const sharedMarkup =
      f.startsWith('packages/markup/') &&
      /from ['"](?:@anima-format\/core|\.\.\/src\/(?:index|names|compile|decompile|format)\.ts)['"]/.test(
        readFileSync(f, 'utf8'),
      );
    return references(f, name) || sharedMarkup;
  });
  const cases = readdirSync('spec/conformance', { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((c) => references(`spec/conformance/${c}/case.ani`, name));
  return { files, cases };
}
export const moduleNames = () =>
  readdirSync('packages/web/src')
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
    .map((f) => basename(f, '.ts'));

export function changedPaths(base?: string) {
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const against = base ?? git('merge-base', 'HEAD', 'main');
  return [
    ...new Set([
      ...git('diff', '--name-only', `${against}...HEAD`).split('\n'),
      ...git('diff', '--name-only', 'HEAD').split('\n'),
      ...git('ls-files', '--others', '--exclude-standard').split('\n'),
    ]),
  ].filter(Boolean);
}
export function targetsForChanges(paths: string[], modules = moduleNames()) {
  const targets = new Set<string>();
  for (const path of paths) {
    if (path.startsWith('spec/conformance/')) targets.add('conformance');
    else if (path.startsWith('tests/oracle/') || path.startsWith('tools/oracle'))
      targets.add('oracle');
    else {
      const pkg = /^packages\/([^/]+)\//.exec(path)?.[1];
      if (pkg && packages.includes(pkg)) {
        const owners = modules.filter((m) => named(path, m));
        if (owners.length) owners.forEach((m) => targets.add(m));
        else targets.add(pkg); // shared core/web files must select their entire package
      } else if (!/^(docs\/|.*\.md$)/.test(path)) {
        packages.forEach((p) => targets.add(p));
        targets.add('tools'); // shared config/tooling/spec changes: conservative coverage
      }
    }
  }
  return [...targets];
}

export interface Scope {
  unit: string[];
  browser: string[];
  conformance: string[];
  casePattern?: string;
  browserPattern?: string;
}
export function selectScope(targets: string[], noBrowser = false, browser?: string): Scope {
  const all = testFiles();
  const selected = new Set<string>();
  const cases = new Set<string>();
  let fullConformance = false;
  for (const target of targets) {
    if (packages.includes(target)) {
      all.filter((f) => f.startsWith(`packages/${target}/`)).forEach((f) => selected.add(f));
      if (target === 'core') fullConformance = true;
    } else if (target === 'conformance') fullConformance = true;
    else if (target === 'tools')
      all.filter((f) => f.startsWith('tools/')).forEach((f) => selected.add(f));
    else if (target === 'oracle') selected.add('tools/oracle.test.ts');
    else if (moduleNames().includes(target)) {
      const owned = moduleFiles(target, all);
      owned.files.forEach((f) => selected.add(f));
      owned.cases.forEach((c) => cases.add(c));
    } else
      throw Error(
        `Unknown target: ${target}. Use ${[...packages, ...moduleNames(), 'conformance', 'oracle', 'tools', 'changed'].join(', ')}`,
      );
  }
  selected.delete(conformanceRunner);
  const sorted = [...selected].sort();
  return {
    unit: sorted.filter((f) => !isBrowser(f)),
    browser: noBrowser ? [] : sorted.filter(isBrowser),
    conformance: fullConformance || cases.size ? [conformanceRunner] : [],
    casePattern: fullConformance
      ? undefined
      : `^conformance > (${[...cases].map(escape).join('|')})$`,
    browserPattern: browser,
  };
}
