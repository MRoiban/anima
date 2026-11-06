// Author independent expected vectors; never derive expected output from Player or runScript.
import '../../packages/core/src/all.ts';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { compile, decompile } from '../../packages/markup/src/index.ts';
// Authored from the declared vocabulary in SPEC.md, independent of the runtime table.
const enumBounds = {
  'horizontal-text-align': ['left', 'justify'],
  'vertical-text-align': ['top', 'bottom'],
  'layout-alignment': ['start', 'space-evenly'],
  'layout-direction': ['inherit', 'rtl'],
  'layout-display': ['flex', 'none'],
  'layout-flex-direction': ['row', 'column-reverse'],
  'layout-position': ['relative', 'absolute'],
  'layout-position-units': ['points', 'auto'],
  'layout-scale-type': ['none', 'fill'],
  'layout-wrap': ['no-wrap', 'wrap-reverse'],
  'scroll-direction': ['horizontal', 'both'],
  'semantic-check-state': ['unchecked', 'mixed'],
  'text-box': ['auto-width', 'fixed'],
  'text-overflow': ['visible', 'ellipsis'],
  'text-trim-bottom': ['none', 'baseline'],
  'text-trim-top': ['none', 'cap-height'],
  'word-wrap': ['word', 'none'],
};
type Obj = Record<string, unknown>;
const root = new URL('../../', import.meta.url);
const completed: string[] = [];
const node = { id: 'dot', type: 'circle', center: [10, 10], r: 1, fill: { color: '#000' } };
const base = (properties: Obj, extra: Obj = {}) => ({
  anima: '0.1',
  name: 'data-probe',
  grid: 20,
  requires: ['data', 'bind'],
  nodes: [node],
  data: { models: { Root: { properties } } },
  ...extra,
});
const snapshot = (values: Obj, states: Obj = {}, settled = true, time = 0) => ({
  time,
  values,
  states,
  events: [],
  settled,
});
function probe(id: string, doc: Obj, script: string, want: Obj[]) {
  const slug = id.replaceAll('.', '-'),
    dir = new URL('spec/conformance/' + slug + '/', root);
  const xml = decompile(doc),
    result = compile(xml);
  if (!result.text || result.diagnostics.length)
    throw Error(id + ': ' + JSON.stringify(result.diagnostics));
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL('case.animl', dir), xml);
  writeFileSync(new URL('case.ani', dir), result.text);
  writeFileSync(new URL('script.txt', dir), script + '\n');
  writeFileSync(
    new URL('expected.jsonl', dir),
    want.map((x) => JSON.stringify(x)).join('\n') + '\n',
  );
  rmSync(new URL('todo.json', dir), { force: true });
  const cap = new URL('modules/data/capabilities/' + slug + '/', root);
  writeFileSync(new URL('example.animl', cap), xml);
  writeFileSync(new URL('example.ani', cap), result.text);
  // Shared implementation/diagnostic tables exercise both syntaxes; remove inert diagnostic stubs.
  rmSync(new URL('modules/data/test/core/' + slug + '.test.ts', root), { force: true });
  writeFileSync(
    new URL('registry.ts', cap),
    "// This capability uses the shared typed data registry.\nexport {dataShape as shape} from '../../core/registry.ts';\n",
  );
  writeFileSync(
    new URL('README.md', cap),
    '# ' +
      id +
      '\n\nImplemented contract: modules/data/SPEC.md.\nConformance: spec/conformance/' +
      slug +
      '/ (independent expected vector).\nDiagnostics: modules/data/test/core/diagnostics.test.ts.\nNative evidence status: modules/data/ROWS.json; pending native probes remain marked.\n',
  );
  completed.push(id);
}
for (const [kind, prop, before, after, token] of [
  ['number', { type: 'number', default: 4 }, 4, 9, '9'],
  ['boolean', { type: 'bool' }, false, true, 'true'],
  ['string', { type: 'string', default: 'Ada' }, 'Ada', 'Grace', '"Grace"'],
  ['color', { type: 'color', default: '#11223344' }, '#11223344', '#aabbccdd', '#aabbccdd'],
  ['enum-custom', { type: 'enum', values: ['calm', 'happy'] }, 'calm', 'happy', 'happy'],
] as const)
  probe(
    'data.property-' + kind,
    base({ value: prop }),
    `advance 0\nsnapshot $value\nset $value ${token}\nadvance 0\nsnapshot $value`,
    [snapshot({ $value: before }), snapshot({ $value: after })],
  );
for (const [system, values] of Object.entries(enumBounds))
  probe(
    'data.system-enum-' + system,
    base({ value: { type: 'enum', system } }),
    `advance 0\nsnapshot $value\nset $value ${values.at(-1)}\nadvance 0\nsnapshot $value`,
    [snapshot({ $value: values[0] }), snapshot({ $value: values.at(-1) })],
  );
probe(
  'data.property-enum-system',
  base({ value: { type: 'enum', system: 'horizontal-text-align' } }),
  'advance 0\nsnapshot $value',
  [snapshot({ $value: 'left' })],
);
for (const id of [
  'data.model-definition',
  'data.default-instance',
  'data.named-instances',
  'data.binding-absolute',
])
  probe(
    id,
    base(
      { value: { type: 'number' } },
      {
        data: {
          models: { Root: { properties: { value: { type: 'number' } } } },
          instances: {
            main: { model: 'Root', default: true, values: { value: 4 } },
            other: { model: 'Root', values: { value: 9 } },
          },
        },
      },
    ),
    'advance 0\nsnapshot $value $main:value $other:value',
    [snapshot({ $value: 4, '$main:value': 4, '$other:value': 9 })],
  );
for (const id of ['data.list-items', 'data.property-list', 'data.property-view-model'])
  probe(
    id,
    base(
      {},
      {
        data: {
          models: {
            Root: {
              properties: {
                team: { type: 'model-ref', model: 'Team' },
                items: { type: 'list', of: 'Team' },
              },
            },
            Team: { properties: { title: { type: 'string', default: 'Blue' } } },
          },
          instances: {
            main: { model: 'Root', default: true, values: { team: 'blue', items: ['blue'] } },
            blue: { model: 'Team' },
          },
        },
      },
    ),
    'advance 0\nsnapshot $team.title $items.0.title $items.length',
    [snapshot({ '$team.title': 'Blue', '$items.0.title': 'Blue', '$items.length': 1 })],
  );
const animated = {
  timelines: {
    t: {
      duration: 1,
      tracks: {
        'dot.x': [
          [0, 1],
          [1, 11],
        ],
      },
    },
  },
  machine: { layers: { m: { initial: 'a', states: { a: { play: 't' } } } } },
};
for (const [id, mode, prefer, first, second, third] of [
  ['data.binding-once', 'once', undefined, 4, 4, 4],
  ['data.binding-to-source', 'to-source', undefined, 1, 6, 11],
  ['data.binding-two-way-prefer-source', 'two-way', 'source', 4, 8, 11],
  ['data.binding-two-way-prefer-target', 'two-way', 'target', 1, 6, 11],
] as const) {
  const spec: Obj = { value: '$value', mode };
  if (prefer) spec.prefer = prefer;
  probe(
    id,
    base({ value: { type: 'number', default: 4 } }, { ...animated, bind: { 'dot.x': spec } }),
    'advance 0\nsnapshot dot.x\nset $value 8\nadvance 0.5\nsnapshot dot.x\nadvance 0.5\nsnapshot dot.x',
    [
      snapshot({ 'dot.x': first }, { m: 'a' }, false),
      snapshot({ 'dot.x': second }, { m: 'a' }, false, 0.5),
      snapshot({ 'dot.x': third }, { m: 'a' }, true, 1),
    ],
  );
}
for (const [suffix, value, type] of [
  ['number', 4, 'number'],
  ['boolean', true, 'bool'],
  ['string', 'Ada', 'string'],
  ['color', '#11223344', 'color'],
  ['enum', 'calm', 'enum'],
] as const) {
  probe(
    'data.custom-property-' + suffix,
    base(
      {
        value: { type, ...(type === 'enum' ? { values: ['calm', 'happy'] } : {}), default: value },
      },
      {
        nodes: [
          {
            ...node,
            properties: {
              custom:
                type === 'color'
                  ? { type, default: '#000' }
                  : type === 'enum'
                    ? { type, values: ['calm', 'happy'], default: 'happy' }
                    : typeof value === 'number'
                      ? 0
                      : typeof value === 'boolean'
                        ? false
                        : '',
            },
          },
        ],
        bind: { 'dot.properties.custom': '$value' },
      },
    ),
    'advance 0\nsnapshot dot.properties.custom',
    [snapshot({ 'dot.properties.custom': value })],
  );
}
for (const id of ['data.property-trigger', 'data.state-action-trigger'])
  probe(
    id,
    base(
      { pulse: { type: 'trigger' } },
      {
        machine: {
          layers: {
            m: {
              initial: 'idle',
              states: {
                idle: { pose: {}, on: [{ when: '$pulse', to: 'done' }] },
                done: { pose: { 'dot.x': 9 } },
              },
            },
          },
        },
      },
    ),
    'fire $pulse\nadvance 0\nsnapshot dot.x',
    [snapshot({ 'dot.x': 9 }, { m: 'done' })],
  );
for (const id of ['input.data-listener', 'input.write-data-constant', 'input.write-data-copy']) {
  const listener =
    id === 'input.data-listener'
      ? { on: 'change:$a', set: { $b: '$b+1' } }
      : id === 'input.write-data-copy'
        ? { on: 'click', copy: '$a -> $b' }
        : { on: 'click', set: { $b: 9 } };
  const script =
    id === 'input.data-listener'
      ? 'set $a 9\nadvance 0\nadvance 0\nsnapshot $b'
      : 'pointer click 10 10\nsnapshot $b';
  probe(
    id,
    base(
      { a: { type: 'number', default: 4 }, b: { type: 'number', default: 2 } },
      { listeners: [listener] },
    ),
    script,
    [snapshot({ $b: id === 'input.data-listener' ? 3 : id === 'input.write-data-copy' ? 4 : 9 })],
  );
}
probe(
  'data.bind-conditions',
  base(
    { Value: { type: 'number', default: 4 } },
    {
      machine: {
        layers: {
          m: {
            initial: 'idle',
            states: {
              idle: { pose: {}, on: [{ when: '$Value > 3', to: 'done' }] },
              done: { pose: { 'dot.x': 9 } },
            },
          },
        },
      },
    },
  ),
  'advance 0\nsnapshot dot.x',
  [snapshot({ 'dot.x': 9 }, { m: 'done' })],
);
probe(
  'data.operation-operand-view-model',
  base({ value: { type: 'number', default: 4 } }, { bind: { 'dot.x': '$value * 2' } }),
  'advance 0\nsnapshot dot.x',
  [snapshot({ 'dot.x': 8 })],
);

probe(
  'drawing-paint.gradient-channel-binding',
  base(
    { value: { type: 'number', default: 40 } },
    {
      requires: ['data', 'bind', 'paint'],
      nodes: [
        {
          ...node,
          fill: {
            type: 'linear',
            x1: 0,
            y1: 0,
            x2: 20,
            y2: 0,
            stops: [
              { position: 0, color: '#000' },
              { position: 1, color: '#fff' },
            ],
          },
        },
      ],
      bind: { 'dot.fill.stops.0.red': '$value' },
    },
  ),
  'advance 0\nsnapshot dot.fill.stops.0.color',
  [snapshot({ 'dot.fill.stops.0.color': '#280000' })],
);
const pulseMachine = {
  layers: {
    m: {
      initial: 'idle',
      states: {
        idle: { pose: {}, on: [{ when: 'dot.properties.pulse', to: 'done' }] },
        done: { pose: { 'dot.x': 9 } },
      },
    },
  },
};
probe(
  'data.custom-property-trigger',
  base(
    {},
    { nodes: [{ ...node, properties: { pulse: { type: 'trigger' } } }], machine: pulseMachine },
  ),
  'fire dot.properties.pulse\nadvance 0\nsnapshot dot.x',
  [snapshot({ 'dot.x': 9 }, { m: 'done' })],
);
for (const [id, on, field, bool] of [
  ['input.write-gamepad-axis', 'gamepad-axis', 'axis', false],
  ['input.write-gamepad-button-pressed', 'gamepad-button', 'button-pressed', true],
  ['input.write-gamepad-button-value', 'gamepad-button', 'button-value', false],
  ['input.write-gamepad-changed-value', 'gamepad-axis', 'changed-value', false],
] as const)
  probe(
    id,
    base(
      { value: { type: bool ? 'bool' : 'number' } },
      {
        requires: ['data', 'bind', 'input'],
        listeners: [
          { on, control: 0, set: { $value: bool ? false : 0 }, value: 'gamepad-' + field + ':0' },
        ],
      },
    ),
    'gamepads [{"index":0,"connected":true,"axes":[0.5],"buttons":[{"pressed":true,"value":0.75}]}]\nsnapshot $value',
    [snapshot({ $value: bool ? true : field === 'button-value' ? 0.75 : 0.5 })],
  );
probe(
  'input.write-focused',
  base(
    { value: { type: 'bool' } },
    {
      requires: ['data', 'bind', 'focus'],
      nodes: [{ ...node, focus: {} }],
      listeners: [{ on: 'click', target: 'dot', set: { $value: false }, value: 'focused' }],
    },
  ),
  'focus target dot\npointer click 10 10\nsnapshot $value',
  [snapshot({ $value: true })],
);
for (const id of ['data.bind-instance-values', 'data.component-public-data', 'data.global-model']) {
  const global = id === 'data.global-model';
  const data = {
    models: { Root: { global, properties: { value: { type: 'number', default: 3 } } } },
    instances: {
      main: { model: 'Root', default: true },
      other: { model: 'Root', values: { value: 8 } },
    },
  };
  const child = { grid: 20, data: 'Root', nodes: [node], bind: { 'dot.x': '$value' } };
  probe(
    id,
    base(
      {},
      {
        requires: ['data', 'bind', 'components'],
        data,
        components: { badge: child },
        nodes: [
          { id: 'a', type: 'instance', component: 'badge', ...(global ? {} : { data: 'main' }) },
          { id: 'b', type: 'instance', component: 'badge', ...(global ? {} : { data: 'other' }) },
        ],
      },
    ),
    'advance 0\nsnapshot a/dot.x b/dot.x\nset $value 7\nadvance 0\nsnapshot a/dot.x b/dot.x',
    [
      snapshot({ 'a/dot.x': 3, 'b/dot.x': global ? 3 : 8 }),
      snapshot({ 'a/dot.x': 7, 'b/dot.x': global ? 7 : 8 }),
    ],
  );
}
for (const kind of ['image', 'font', 'blob'])
  probe(
    'data.property-asset-' + kind,
    base(
      { value: { type: 'asset-ref', assetType: kind, default: 'first' } },
      {
        requires: ['data', 'bind', 'assets'],
        assets: {
          // Images get real 1×1 PNGs: visual harnesses load every image asset.
          first: {
            type: kind,
            source:
              kind === 'image'
                ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mO4WR4OAAPUAahSxzpbAAAAAElFTkSuQmCC'
                : 'first.bin',
          },
          second: {
            type: kind,
            source:
              kind === 'image'
                ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mMIL78JAALQAagz8EUKAAAAAElFTkSuQmCC'
                : 'second.bin',
          },
        },
      },
    ),
    'advance 0\nsnapshot $value\nset $value second\nadvance 0\nsnapshot $value',
    [snapshot({ $value: 'first' }), snapshot({ $value: 'second' })],
  );
probe(
  'data.enum-members',
  base(
    { value: { type: 'enum', enum: 'Mood' } },
    {
      data: {
        enums: {
          Mood: [
            { key: 'calm', label: 'Calm' },
            { key: 'happy', label: 'Happy' },
          ],
        },
        models: { Root: { properties: { value: { type: 'enum', enum: 'Mood' } } } },
      },
    },
  ),
  'advance 0\nsnapshot $value\nset $value happy\nadvance 0\nsnapshot $value',
  [snapshot({ $value: 'calm' }), snapshot({ $value: 'happy' })],
);
writeFileSync(
  new URL('modules/data/implemented.json', root),
  JSON.stringify(completed, null, 2) + '\n',
);
console.log('Authored', completed.length, 'independent conformance cases');
