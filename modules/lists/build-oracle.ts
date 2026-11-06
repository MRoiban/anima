// Normalize independently captured native dumps. Never sample Anima for expected values.
import '../../packages/core/src/all.ts';
import { format } from 'prettier';
import { compile, formatMarkup } from '../../packages/markup/src/index.ts';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import type { Document } from './test/core/document.ts';
const read = (p: string) => readFileSync(p, 'utf8');
const json = (p: string) => JSON.parse(read(p));
interface Property {
  name: string;
  value: number;
  items?: { properties: Property[] }[];
}
interface Native {
  viewModel: { properties: Property[] };
  nested: { path: string; inherits?: boolean; viewModels?: { properties: Property[] }[] }[];
}
const prop = (ps: Property[], name: string) => ps.find((p) => p.name === name)!;
const captured = (dir: string, frame = 'initial') =>
  json(`modules/lists/oracle/${dir}/frames/${frame}.json`) as Native;
const root = captured('rive');
const list = prop(root.viewModel.properties, 'players').items!;
const score = (i: number) => prop(list[i]!.properties, 'score').value;
const ordinal = (i: number) => prop(list[i]!.properties, 'ordinal').value;
const parent = prop(
  root.nested.find((n) => n.path === 'rows[1]')!.viewModels![0]!.properties,
  'parentBonus',
).value;
const explicit = prop(
  root.nested.find((n) => n.path === 'explicit')!.viewModels![0]!.properties,
  'score',
).value;
if (!root.nested.find((n) => n.path === 'rows[0]/inherited')?.inherits)
  throw Error('native inherited context absent');
const source = (name: string) => read('spec/conformance/' + name + '/case.animl');
const values = { 'rows/0/dot.r': score(0), 'rows/1/dot.r': score(1) };
const mapped = prop(captured('map').viewModel.properties, 'players').items!;
const sizeDoc = compile(source('components-list')).doc! as unknown as Document;
sizeDoc.data.models.Player!.properties.clicked = { type: 'number' };
(sizeDoc.components.row as unknown as { listeners: object[] }).listeners = [
  { on: 'click', set: { $clicked: 1 } },
];
sizeDoc.components.row!.bind['dot.opacity'] = '$clicked';
const { decompile } = await import('../../packages/markup/src/index.ts');
interface Observation {
  click: number;
  values: Record<string, unknown>;
  events: unknown[];
}
const one = (values: Observation['values']) => [{ click: 0, values, events: [] }];
const cases: { name: string; source: string; script?: string; observations: Observation[] }[] = [
  { name: 'components-list', source: source('components-list'), observations: one(values) },
  {
    name: 'components-list-map',
    source: source('components-list-map'),
    observations: one(
      Object.fromEntries(
        mapped.map((i, n) => ['rows/' + n + '/dot.r', prop(i.properties, 'score').value]),
      ),
    ),
  },
  {
    name: 'data-property-symbol-list-index',
    source: source('data-property-symbol-list-index'),
    observations: one({ 'rows/0/dot.x': ordinal(0), 'rows/1/dot.x': ordinal(1) }),
  },
  {
    name: 'data-binding-relative',
    source: source('data-binding-relative'),
    observations: one({ 'rows/0/dot.y': parent, 'rows/1/dot.y': parent }),
  },
  {
    name: 'components-explicit-context',
    source: source('components-explicit-context').replace('value="11"', 'value="3"'),
    observations: one({ 'one/dot.r': explicit }),
  },
  {
    name: 'components-inherited-context',
    source: source('components-inherited-context'),
    observations: one({ 'rows/0/child/dot.r': score(0), 'rows/1/child/dot.r': score(1) }),
  },
  {
    name: 'components-list-size-override',
    source: decompile(sizeDoc),
    script:
      'advance 0\nsnapshot rows/0/dot.opacity rows/1/dot.opacity\npointer click 25 5\nsnapshot rows/0/dot.opacity rows/1/dot.opacity\n',
    observations: ['initial', 'expanded'].map((f, click) => ({
      click,
      values: Object.fromEntries(
        prop(captured('size', f).viewModel.properties, 'players').items!.map((item, i) => [
          'rows/' + i + '/dot.opacity',
          prop(item.properties, 'clicked').value,
        ]),
      ),
      events: [],
    })),
  },
  {
    name: 'data-converter-number-to-list',
    source: source('data-converter-number-to-list'),
    script: read('spec/conformance/data-converter-number-to-list/script.txt'),
    observations: ['initial', 'three', 'one'].map((f, click) => ({
      click,
      values: Object.fromEntries(
        captured('count', f)
          .nested.filter((n) => /^rows\[\d+\]$/.test(n.path))
          .map((n) => [
            'rows/' + n.path.match(/\d+/)![0] + '/dot.x',
            prop(n.viewModels![0]!.properties, 'ordinal').value,
          ]),
      ),
      events: [],
    })),
  },
];
let manifestSource = read('tests/oracle/cases.json');
const manifest = JSON.parse(manifestSource) as { name: string }[];
for (const c of cases) {
  const dir = 'tests/oracle/' + c.name;
  mkdirSync(dir + '/rive', { recursive: true });
  const formatted = formatMarkup(c.source);
  if (!formatted.text) throw Error(JSON.stringify(formatted.diagnostics));
  const compiled = compile(formatted.text);
  if (!compiled.text) throw Error(JSON.stringify(compiled.diagnostics));
  writeFileSync(dir + '/case.animl', formatted.text);
  writeFileSync(dir + '/case.ani', compiled.text);
  writeFileSync(
    dir + '/script.txt',
    c.script ?? 'advance 0\nsnapshot ' + Object.keys(c.observations[0]!.values).join(' ') + '\n',
  );
  writeFileSync(dir + '/rive/observations.json', JSON.stringify(c.observations, null, 2) + '\n');
  writeFileSync(
    dir + '/rive/README.md',
    'Independent native sources, commands, raw dumps and session logs: modules/lists/oracle/.\nNormalization: modules/lists/build-oracle.ts. No Anima output produces expected values.\nSize checks click (25,5) outside the original width 10, inside the overridden width 30; clicked changes 0→1.\nMap checks Player and Header models. Count checks indices after lengths 2→3→1.\n',
  );
  rmSync(dir + '/todo.json', { force: true });
  if (!manifest.some((v) => v.name === c.name)) {
    const entry = {
      name: c.name,
      times: [0],
      threshold: 0,
      maxOverPercent: 0,
      maxDiff: 0,
      observations: { script: 'script.txt', reference: 'rive/observations.json' },
    };
    const text = (await format(JSON.stringify(entry, null, 2), { parser: 'json', printWidth: 100 }))
      .trimEnd()
      .split('\n')
      .map((line) => '  ' + line)
      .join('\n');
    manifestSource =
      manifestSource.slice(0, manifestSource.lastIndexOf(']')).trimEnd() +
      (manifest.length ? ',\n' : '\n') +
      text +
      '\n]\n';
    manifest.push(entry);
  }
}
writeFileSync('tests/oracle/cases.json', manifestSource);
