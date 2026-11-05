// Size budgets and ceilings (owner, 2026-11-06; docs/PLAN.md "Size ceilings"). All min+gzip.
//   core + web: every page pays for it — ceiling 30 KB.
//   each module: its own budget, never above 8 KB (split a module before raising it).
//   full-featured (core + web + every SVG-path module): ceiling 100 KB.
//   Rive-class (adds canvas/WebGL, rigging, text, scripting): ceiling 250 KB.
// A module over its own budget fails the check; raising a budget inside the ceilings is allowed
// with a reason in docs/LOG.md. Crossing a ceiling is the owner's call.
import { existsSync, writeFileSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { bundle } from './browser-build.ts';

const KB = 1024;
const CORE_WEB_CEILING = 30 * KB;
const MODULE_CEILING = 8 * KB;
const FULL_CEILING = 100 * KB;
const RIVE_CLASS_CEILING = 250 * KB;

/** Browser modules: entry under packages/web/src, budget, and whether it is heavy (Rive-class only). */
const MODULES: { name: string; budget: number; heavy?: boolean; over?: string }[] = [
  // Raised from 6 KB at P4a (docs/LOG.md P4a): every module adds markup forms.
  { name: 'markup', budget: 8 * KB },
  // Measured on top of web + markup, which it extends.
  { name: 'markup-libraries', budget: 2 * KB, over: 'markup' },
  // Registration-only layers extend web; components/bind also import them automatically.
  { name: 'markup-components', budget: 2 * KB, over: 'index' },
  { name: 'markup-paint', budget: 2 * KB, over: 'index' },
  { name: 'markup-bind', budget: 2 * KB, over: 'index' },
  { name: 'paint', budget: 5 * KB },
  { name: 'composite', budget: 4 * KB },
  { name: 'bind', budget: 2 * KB },
  { name: 'assets', budget: 2 * KB },
  { name: 'components', budget: 4 * KB },
  { name: 'canvas', budget: 8 * KB, heavy: true },
];

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

// Use-case totals: one bundle importing every module of the class, so shared code counts once.
const total = async (mods: typeof present) => {
  const entry = new URL('./.size-entry.ts', import.meta.url).pathname;
  writeFileSync(
    entry,
    mods.map((m) => `import '${src(m.name)}';`).join('\n') + `\nimport '${src('index')}';\n`,
  );
  try {
    return gz(await bundle(entry));
  } finally {
    rmSync(entry, { force: true });
  }
};
const full = await total(present.filter((m) => !m.heavy));
report(`full-featured total: ${full} B min+gzip (ceiling ${FULL_CEILING} B)`, full > FULL_CEILING);
const rive = await total(present);
report(
  `Rive-class total: ${rive} B min+gzip (ceiling ${RIVE_CLASS_CEILING} B)`,
  rive > RIVE_CLASS_CEILING,
);

if (failed) process.exitCode = 1;
