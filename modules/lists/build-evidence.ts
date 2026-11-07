// Authored constants and arithmetic below are independent expectations, never player output.
import '../../packages/core/src/all.ts';
import { compile, formatMarkup, decompile } from '../../packages/markup/src/index.ts';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
const base = readFileSync('modules/lists/examples/players.animl', 'utf8');
const sample = (
  values: Record<string, unknown>,
  time = 0,
  events: unknown[] = [],
  states: Record<string, string> = {},
) => ({
  time,
  values,
  states,
  events,
  settled: true,
});
const mixed = compile(base).doc! as unknown as {
  data: import('./test/core/document.ts').Document['data'];
  components: import('./test/core/document.ts').Document['components'];
  nodes: Record<string, unknown>[];
};
mixed.data.models.Header = { properties: { score: { type: 'number' } } };
delete mixed.data.models.Board!.properties.players!.of;
mixed.data.instances.main!.values.players = [
  { model: 'Player', values: { score: 3 } },
  { model: 'Player', values: { score: 7 } },
  { model: 'Header', values: { score: 9 } },
];
mixed.components.header = {
  grid: 10,
  data: 'Header',
  nodes: [{ id: 'dot', type: 'circle', center: [2, 2], r: 1, fill: { color: '#000' } }],
  bind: { 'dot.r': '$score' },
};
mixed.nodes[0]!.component = { Player: 'row', Header: 'header' };
const two = { 'rows/0/dot.r': 3, 'rows/1/dot.r': 7 };
const countSource = base
  .replace(
    '<list name="players" of="Player"/>',
    '<list name="players" of="Player"/><number name="n" default="2"/>',
  )
  .replace('list="$players"', 'count="$n"')
  .replace(
    '<component name="row" grid="10" data="Player">',
    '<component name="row" grid="10" data="Player"><trigger name="go"/><layer name="selection" initial="idle"><state name="idle"><on when="go" to="selected"/></state><state name="selected"><pose dot.scale="0.5"/></state></layer>',
  );
const selection = (n: number, selected = false) =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [
      'rows/' + i + '/selection',
      selected && i === 0 ? 'selected' : 'idle',
    ]),
  );
const cases = [
  {
    id: 'components.list',
    source: base,
    script:
      'advance 0\nsnapshot rows/0/dot.r rows/1/dot.r\nset $players.0.score 9\nadvance 0\nsnapshot rows/0/dot.r rows/1/dot.r\n',
    want: [sample(two), sample({ ...two, 'rows/0/dot.r': 9 })],
  },
  {
    id: 'components.list-map',
    source: decompile(mixed),
    script: 'advance 0\nsnapshot rows/0/dot.r rows/1/dot.r rows/2/dot.r\n',
    want: [sample({ ...two, 'rows/2/dot.r': 9 })],
  },
  {
    id: 'components.list-size-override',
    source: base.replace(
      '<bind target="dot.r"',
      '<listener on="click" emit="selected"/>\n    <bind target="dot.r"',
    ),
    script: 'advance 0\npointer click 25 5\nsnapshot rows/0/dot.r\n',
    want: [sample({ 'rows/0/dot.r': 3 }, 0, [{ name: 'rows.0.selected', layer: null, time: 0 }])],
  },
  {
    id: 'components.explicit-context',
    source: base
      .replace(
        '<repeat id="rows" list="$players" component="row" dy="10" size="30 10"/>',
        '<instance id="one" component="row" data="ada"/>',
      )
      .replace(
        '<instance name="main"',
        '<instance name="ada" model="Player"><set path="score" value="11"/></instance>\n  <instance name="main"',
      ),
    script: 'advance 0\nsnapshot one/dot.r one/dot.y\n',
    want: [sample({ 'one/dot.r': 11, 'one/dot.y': 2 })],
  },
  {
    id: 'components.inherited-context',
    source: base
      .replace('<circle id="dot"', '<instance id="child" component="child"/>\n    <circle id="dot"')
      .replace(
        '<component name="row"',
        '<component name="child" grid="10"><circle id="dot" cx="2" cy="2" r="1" fill="#000"/><bind target="dot.r" value="$score"/></component>\n  <component name="row"',
      ),
    script: 'advance 0\nsnapshot rows/0/child/dot.r rows/1/child/dot.r\n',
    want: [sample({ 'rows/0/child/dot.r': 3, 'rows/1/child/dot.r': 7 })],
  },
  {
    id: 'data.binding-relative',
    source: base,
    script:
      'advance 0\nsnapshot rows/0/dot.y rows/1/dot.y\nset $bonus 4\nadvance 0\nsnapshot rows/0/dot.y rows/1/dot.y\n',
    want: [
      sample({ 'rows/0/dot.y': 2, 'rows/1/dot.y': 2 }),
      sample({ 'rows/0/dot.y': 4, 'rows/1/dot.y': 4 }),
    ],
  },
  {
    id: 'data.property-symbol-list-index',
    source: base,
    script: 'advance 0\nsnapshot rows/0/dot.x rows/1/dot.x\n',
    want: [sample({ 'rows/0/dot.x': 0, 'rows/1/dot.x': 1 })],
  },
  {
    id: 'data.converter-number-to-list',
    source: countSource,
    script:
      'advance 0\nsnapshot rows/0/dot.x rows/1/dot.x\nfire rows.0.go\nset $n 3\nadvance 0\nsnapshot rows/0/dot.x rows/1/dot.x rows/2/dot.x\nset $n 1\nadvance 0\nsnapshot rows/0/dot.x\n',
    want: [
      sample({ 'rows/0/dot.x': 0, 'rows/1/dot.x': 1 }, 0, [], selection(2)),
      sample(
        { 'rows/0/dot.x': 0, 'rows/1/dot.x': 1, 'rows/2/dot.x': 2 },
        0,
        [],
        selection(3, true),
      ),
      sample({ 'rows/0/dot.x': 0 }, 0, [], selection(1, true)),
    ],
  },
];
cases.push({
  id: 'lists.count-inheritance',
  source: base
    .replace(' data="Player"', '')
    .replace('list="$players"', 'count="$bonus"')
    .replace('value="$score"', 'value="$bonus"'),
  script:
    'advance 0\nsnapshot rows/0/dot.r rows/1/dot.r\nset $bonus 3\nadvance 0\nsnapshot rows/0/dot.r rows/1/dot.r rows/2/dot.r\n',
  want: [
    sample({ 'rows/0/dot.r': 2, 'rows/1/dot.r': 2 }),
    sample({ 'rows/0/dot.r': 3, 'rows/1/dot.r': 3, 'rows/2/dot.r': 3 }),
  ],
});
for (const c of cases) {
  const name = c.id.replaceAll('.', '-');
  const result = formatMarkup(c.source);
  if (!result.text) throw Error(JSON.stringify(result.diagnostics));
  const source = result.text;
  const compiled = compile(source);
  if (!compiled.text) throw Error(JSON.stringify(compiled.diagnostics));
  for (const dir of [
    'spec/conformance/' + name,
    ...(c.id.startsWith('lists.') ? [] : ['modules/lists/capabilities/' + name]),
  ]) {
    mkdirSync(dir, { recursive: true });
    const example = dir.startsWith('modules') ? 'example' : 'case';
    writeFileSync(dir + '/' + example + '.animl', source);
    writeFileSync(dir + '/' + example + '.ani', compiled.text);
  }
  const probe = 'spec/conformance/' + name;
  writeFileSync(probe + '/script.txt', c.script);
  writeFileSync(probe + '/expected.jsonl', c.want.map((v) => JSON.stringify(v)).join('\n') + '\n');
  rmSync(probe + '/todo.json', { force: true });
  if (!c.id.startsWith('lists.'))
    writeFileSync(
      'modules/lists/capabilities/' + name + '/README.md',
      `# ${c.id}\n\nImplemented by modules/lists/core; normative contract: modules/lists/SPEC.md.\nIndependent conformance: ${probe}. Identity mutations are exercised in lists.test.ts.\nOracle evidence and limitations: modules/lists/REPORT.md. Parity status is unchanged.\n`,
    );
}
const root = compile(base);
writeFileSync('modules/lists/examples/players.ani', root.text!);
