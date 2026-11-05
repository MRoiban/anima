import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { globSync } from 'node:fs';
import { moduleScopes, webEntries, webOwners } from './modules.generated.ts';

export const packages = ['core', 'markup', 'web', 'cli', 'playground'];
export const conformanceRunner = 'packages/core/test/conformance.test.ts';
export const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  );
export const testFiles = () =>
  [
    ...filesUnder('packages'),
    ...filesUnder('tools'),
    ...globSync('modules/*/test/**/*.test.ts'),
  ].filter((f) => f.endsWith('.test.ts'));
export const isBrowser = (file: string) =>
  /from ['"]playwright-core['"]/.test(readFileSync(file, 'utf8'));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const named = (file: string, name: string) =>
  new RegExp(`(^|[/.\\-])${escape(name)}([/.\\-]|$)`).test(file);
/** Explicit manifest ownership: never pull unrelated browser suites in through their imports. */
export function moduleFiles(name: string, all = testFiles()) {
  const scope = moduleScopes[(webOwners[name] ?? name) as keyof typeof moduleScopes];
  if (!scope) return { files: [], cases: [] };
  const owned = new Set(globSync(scope.tests));
  const files = all.filter((f) => owned.has(f));
  const cases = readdirSync('spec/conformance', { withFileTypes: true })
    .filter((e) => e.isDirectory() && scope.conformance.some((prefix) => e.name.startsWith(prefix)))
    .map((e) => e.name);
  return { files, cases };
}
export const moduleNames = () => [
  ...new Set([...Object.keys(moduleScopes), ...webEntries.filter((e) => e !== 'index')]),
];
const packageOwns = (file: string, pkg: string) =>
  file.startsWith(`packages/${pkg}/`) || new RegExp(`^modules/[^/]+/test/${pkg}/`).test(file);

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
    const module = /^modules\/([^/]+)\//.exec(path)?.[1];
    if (module && modules.includes(module)) targets.add(module);
    else if (path.startsWith('spec/conformance/')) targets.add('conformance');
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
      all.filter((f) => packageOwns(f, target)).forEach((f) => selected.add(f));
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
