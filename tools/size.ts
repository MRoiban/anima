// Size gates (owner decision, 2026-11-07; docs/PLAN.md "Size ceilings"). All min+gzip. They replace the
// single "full-featured ≤ 128 KB" ceiling (which bundled the in-browser compiler and devtools that no
// shipped page loads) and are final for the in-scope plan through P8: a phase that would cross one cuts
// code or moves it to a heavy or optional module; only if neither works does it go to the owner, with
// numbers.
//   core + web (every page):                          24 KB (tightened from 30 KB).
//   each scene's real bundle, from its `requires`:    64 KB (every examples/*.ani and benchmark scene).
//   app-UI scene (APP_UI below, a fixed reference set of the runtime modules an app UI uses together;
//     add text (not text input) and layout as they land): 128 KB.
//   sum of every runtime module (sprawl guard; authoring and heavy excluded): 160 KB.
//   authoring add-on (manifest `authoring: true`: markup*, devtools, future in-browser compilers or
//     inspectors), on top of core + web:              16 KB; not counted in page totals.
//   heavy / Rive-class (canvas, rigging, text input, later GPU), with all runtime modules: 250 KB.
//   each module: its own budget, never above 8 KB (split a module before raising it).
// A module over its own budget fails the check. After the pre-P6 size round, budgets are reset to leave
// ~10 % headroom as a design target.
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { globSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { bundle } from './browser-build.ts';

const KB = 1024;
const CORE_WEB_CEILING = 24 * KB;
const MODULE_CEILING = 8 * KB;
const SCENE_CEILING = 64 * KB;
const APP_UI_CEILING = 128 * KB;
const RUNTIME_SUM_CEILING = 160 * KB;
const AUTHORING_CEILING = 16 * KB;
const RIVE_CLASS_CEILING = 250 * KB;
// The app-UI reference set (owner, 2026-11-07), by browser entry. Add text (not text input) and layout
// entries as they land.
const APP_UI = [
  'paint',
  'assets',
  'assetio',
  'events',
  'components',
  'lists',
  'data',
  'bind',
  'derive',
  'motion',
  'machine',
  'input',
  'focus',
  'convert',
  'host',
  'host-values',
  'a11y',
  'a11y-actions',
  'a11y-dom',
  'composite',
];

import { moduleBudgets as MODULES, webOwners } from './modules.generated.ts';
import { discover } from './modules.ts';

const src = (name: string) => new URL(`../packages/web/src/${name}.ts`, import.meta.url).pathname;
const gz = (code: string) => gzipSync(code, { level: 9 }).length;
let failed = false;
const report = (line: string, over: boolean) => {
  if (over) {
    console.error(`${line} — over`);
    failed = true;
  } else console.log(line);
};

const base = gz(await bundle(src('index')));
report(`core+web: ${base} B min+gzip (ceiling ${CORE_WEB_CEILING} B)`, base > CORE_WEB_CEILING);

const present = MODULES.filter((m) => existsSync(src(m.name)));
for (const m of present) {
  if (m.budget > MODULE_CEILING) throw new Error(`${m.name}: budget above the module ceiling`);
  const under = m.over ? gz(await bundle(src(m.over))) : base;
  const delta = gz(await bundle(src(m.name))) - under;
  const what = m.over === 'index' ? 'over web' : m.over ? `over web+${m.over}` : 'incremental';
  report(`${m.name}: ${delta} B min+gzip ${what} (budget ${m.budget} B)`, delta > m.budget);
}

// Use-case totals: one bundle importing every entry of the set, so shared code counts once.
const total = async (names: string[]) => {
  const entry = new URL('./.size-entry.ts', import.meta.url).pathname;
  writeFileSync(
    entry,
    names.map((n) => `import '${src(n)}';`).join('\n') + `\nimport '${src('index')}';\n`,
  );
  try {
    return gz(await bundle(entry));
  } finally {
    rmSync(entry, { force: true });
  }
};
const names = (ms: typeof present) => ms.map((m) => m.name);
const runtime = present.filter((m) => !m.authoring);

// Scenes: each document's real bundle, from the features it requires. A feature is the runtime
// name of a module's core export; its non-authoring browser entries are the ones a page loads.
const root = new URL('..', import.meta.url).pathname;
const featureEntries = new Map<string, string[]>();
for (const m of await discover(root)) {
  if (!m.core) continue;
  const mod = (await import(`../modules/${m.name}/${m.core.entry}`))[m.core.export] as {
    name: string;
  };
  const entries = runtime.filter((e) => webOwners[e.name] === m.name).map((e) => e.name);
  featureEntries.set(mod.name, entries);
}
const scenes = [
  ...globSync('examples/*.ani', { cwd: root }),
  ...globSync('docs/benchmarks/runs/*/animl*/*.ani', { cwd: root }),
].sort();
let largest = 0;
for (const file of scenes) {
  const requires: string[] = JSON.parse(readFileSync(root + file, 'utf8')).requires ?? [];
  const entries = [...new Set(requires.flatMap((f) => featureEntries.get(f) ?? []))];
  const unknown = requires.filter((f) => !featureEntries.has(f));
  if (unknown.length)
    throw new Error(`${file}: no browser entry for feature(s) ${unknown.join(', ')}`);
  const bytes = entries.length ? await total(entries) : base;
  largest = Math.max(largest, bytes);
  report(`scene ${file}: ${bytes} B min+gzip (ceiling ${SCENE_CEILING} B)`, bytes > SCENE_CEILING);
}

const appUI = await total(APP_UI.filter((n) => runtime.some((m) => m.name === n)));
const sum = await total(names(runtime.filter((m) => !m.heavy)));
const authoring = (await total(names(present.filter((m) => m.authoring)))) - base;
const rive = await total(names(runtime));
console.log('');
console.log('gate                     value (B)   ceiling (B)');
const gate = (name: string, value: number, ceiling: number) =>
  report(
    `${name.padEnd(24)} ${String(value).padStart(9)}   ${String(ceiling).padStart(11)}`,
    value > ceiling,
  );
gate('core+web', base, CORE_WEB_CEILING);
gate(`largest scene (${scenes.length})`, largest, SCENE_CEILING);
gate('app-UI scene', appUI, APP_UI_CEILING);
gate('runtime sum', sum, RUNTIME_SUM_CEILING);
gate('authoring add-on', authoring, AUTHORING_CEILING);
gate('Rive-class (heavy)', rive, RIVE_CLASS_CEILING);

if (failed) process.exitCode = 1;
