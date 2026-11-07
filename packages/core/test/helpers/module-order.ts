// One fresh Node process per order; importing tooling first would hide registration-order bugs.
import { globSync, readFileSync } from 'node:fs';
import { registerModule, jsonSchema, load, Player, runScript } from '../../src/index.ts';
import type { Module } from '../../src/modules.ts';
const order = process.argv[2]!.split(',');
for (const name of order) {
  // The manifest names the core export (folder `host-edit` exports `hostedit`).
  const manifest = (await import(`../../../../modules/${name}/manifest.ts`)).default;
  const exported = await import(`../../../../modules/${name}/${manifest.core.entry}`);
  registerModule(exported[manifest.core.export] as Module);
}
// seam(P6-6): field scripts request semantic bounds before tooling registration.
// The original fixture font keeps that layout deterministic without importing core/all.
const { registerTextMeasurer } = await import('../../../../modules/text/core/measure.ts');
const { ToolMeasurer } = await import('../../../cli/src/font/measure.ts');
const { Font } = await import('../../../cli/src/font/reader.ts');
const { testFont } = await import('../../../../tools/test-font.ts');
const measurer = new ToolMeasurer();
measurer.register('sans-serif', new Font(testFont()));
registerTextMeasurer(measurer);
// Schema and models captured before tooling's all-module import can mask missing registration.
const schema = jsonSchema();
const files = globSync([
  'examples/**/*.ani',
  'spec/conformance/*/case.ani',
  'spec/draw-conformance/*/case.ani',
]).sort();
// seam(P6-7): text semantics need the tool measurer before runScript, without importing core/all.
const { documentFonts, installToolMeasurer } = await import('../../../cli/src/font/document.ts');
const models = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const doc = JSON.parse(source);
  if (doc.requires?.includes('text')) {
    const fonts = documentFonts(doc, file);
    if (fonts.diagnostics.some((d) => d.severity === 'error'))
      throw Error(`${file}: ${JSON.stringify(fonts.diagnostics)}`);
    await installToolMeasurer(fonts.measurer);
  }
  const result = load(source);
  if (!result.model) throw Error(`${file}: ${JSON.stringify(result.diagnostics)}`);
  const player = new Player(result.model);
  const script = file.startsWith('spec/conformance/')
    ? readFileSync(file.replace('case.ani', 'script.txt'), 'utf8')
    : 'advance 0.25\nsnapshot';
  models.push({
    file,
    ...result,
    snapshots: runScript(result.model, script).snapshots,
    initial: player.values(),
  });
}
const { run } = await import('../../../cli/src/cli.ts');
const cli: string[] = [];
for (const topic of [
  undefined,
  'fill',
  'stroke',
  'rect',
  'image',
  'instance',
  'imagePaint',
  'slice',
  'feather',
]) {
  for (const mode of [[], ['--format=json']]) {
    const code = await run(['schema', ...(topic ? [topic] : []), ...mode], {
      out: (s) => cli.push(s),
      err: (s) => {
        throw Error(s);
      },
    });
    if (code !== 0) throw Error('schema command failed');
  }
}
const { compile } = await import('../../../markup/src/index.ts');
const markup = globSync([
  'examples/**/*.animl',
  'spec/conformance/*/case.animl',
  'spec/draw-conformance/*/case.animl',
])
  .filter((f) => !f.startsWith('examples/lib/'))
  .sort()
  .map((file) => {
    const result = compile(readFileSync(file, 'utf8'), {
      file,
      resolve: (p) => readFileSync(p, 'utf8'),
    });
    if (!result.doc) throw Error(`${file}: ${JSON.stringify(result.diagnostics)}`);
    return { file, ...result };
  });
// Include maps, typed arrays, and module/function identities rather than silently dropping them.
const seen = new WeakMap<object, number>();
let nextId = 0;
console.log(
  JSON.stringify({ schema, cli, models, markup }, (_key, value) => {
    if (value && typeof value === 'object') {
      if (seen.has(value)) return { $ref: seen.get(value) };
      seen.set(value, nextId++);
    }
    if (value instanceof Map) return [...value];
    if (ArrayBuffer.isView(value)) return Array.from(value as Float64Array);
    if (typeof value === 'function') return value.toString();
    if (value instanceof RegExp) return value.toString();
    return value;
  }),
);
