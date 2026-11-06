import '../../packages/core/src/all.ts';
import { compile, decompile } from '../../packages/markup/src/index.ts';
// Normalize native data dump path/color spellings only; no Anima player produces references.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const root = 'modules/data/oracle/';
const scalar = json(root + 'rive/frames/initial.json').viewModel.properties;
const changed = json(root + 'rive/frames/changed.json').viewModel.properties;
const refs = json(root + 'reference/rive/frames/initial.json').viewModel.properties;
const scalarValue = (properties: typeof scalar, name: string) => {
  const p = properties.find((p: { name: string }) => p.name === name);
  return p.type === 'color'
    ? '#' + p.value.slice(2).toLowerCase() + p.value.slice(0, 2).toLowerCase()
    : p.value;
};
const refValue = (name: string) => refs.find((p: { name: string }) => p.name === name);
const verified: Record<
  string,
  {
    source: string;
    script: string;
    values: Record<string, unknown>[];
    doc?: Record<string, unknown>;
  }
> = {};
for (const [kind, name, token] of [
  ['number', 'score', '9'],
  ['boolean', 'active', 'true'],
  ['string', 'label', '"Grace"'],
  ['color', 'tint', '#aabbccdd'],
])
  verified['data.property-' + kind] = {
    source: 'rive',
    script: `advance 0\nsnapshot $value\nset $value ${token}\nadvance 0\nsnapshot $value\n`,
    values: [{ $value: scalarValue(scalar, name!) }, { $value: scalarValue(changed, name!) }],
  };
for (const id of ['data.property-enum-custom', 'data.enum-members'])
  verified[id] = {
    source: 'reference/rive',
    script: 'advance 0\nsnapshot $value\n',
    values: [{ $value: refValue('mood').value }],
  };
for (const id of ['data.list-items', 'data.property-list', 'data.property-view-model'])
  verified[id] = {
    source: 'reference/rive',
    script: 'advance 0\nsnapshot $team.title $items.0.title $items.length\n',
    values: [
      {
        '$team.title': refValue('team').value.properties[0].value,
        '$items.0.title': refValue('items').items[0].properties[0].value,
        '$items.length': refValue('items').size,
      },
    ],
  };
for (const id of ['data.model-definition', 'data.default-instance'])
  verified[id] = {
    source: 'rive',
    script: 'advance 0\nsnapshot $value\n',
    values: [{ $value: scalarValue(scalar, 'score') }],
  };

const base = (properties: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  anima: '0.1',
  name: 'oracle-data',
  grid: 20,
  requires: ['data', 'bind'],
  data: { models: { Root: { properties } } },
  nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 8, fill: { color: '#000' } }],
  ...extra,
});
for (const [id, source, mode, prefer] of [
  ['data.binding-once', 'once', 'once', undefined],
  ['data.binding-to-source', 'to-source', 'to-source', undefined],
  ['data.binding-two-way-prefer-source', 'two-way-source', 'two-way', 'source'],
  ['data.binding-two-way-prefer-target', 'two-way-target', 'two-way', 'target'],
] as const) {
  const frames = ['initial', 'changed'].map(
    (n) => json(root + 'modes/' + source + '/rive/frames/' + n + '.json').viewModel.properties,
  );
  const spec: Record<string, unknown> = { value: '$value', mode };
  if (prefer) spec.prefer = prefer;
  verified[id] = {
    source: 'modes/' + source + '/rive',
    doc: base(
      { value: { type: 'number', default: 4 } },
      {
        nodes: [
          { id: 'dot', type: 'circle', center: [10, 10], r: 1, x: 1, fill: { color: '#000' } },
        ],
        bind: { 'dot.x': spec },
      },
    ),
    script: 'advance 0\nsnapshot dot.x $value\nset $value 8\nadvance 0\nsnapshot dot.x $value\n',
    values: frames.map((properties) => ({
      'dot.x': scalarValue(properties, 'observed'),
      $value: scalarValue(properties, 'score'),
    })),
  };
}
verified['data.binding-absolute'] = {
  source: 'rive',
  script: 'advance 0\nsnapshot $main:value\n',
  values: [{ '$main:value': scalarValue(scalar, 'score') }],
};
for (const [id, source, sourceValue, on] of [
  ['input.write-gamepad-axis', 'gamepadAxis', 'gamepad-axis:0', 'gamepad-axis'],
  [
    'input.write-gamepad-button-pressed',
    'gamepadButtonPressed',
    'gamepad-button-pressed:0',
    'gamepad-button',
  ],
  [
    'input.write-gamepad-button-value',
    'gamepadButtonValue',
    'gamepad-button-value:0',
    'gamepad-button',
  ],
  [
    'input.write-gamepad-changed-value',
    'gamepadChangedValue',
    'gamepad-changed-value:0',
    'gamepad-axis',
  ],
  ['input.write-focused', 'focused', 'focused', 'focus'],
  ['input.write-data-constant', 'constant', undefined, 'click'],
  ['input.write-data-copy', 'copy', undefined, 'click'],
  ['input.data-listener', 'change', undefined, 'change:$source'],
] as const) {
  const bool = source === 'gamepadButtonPressed' || source === 'focused';
  const action: Record<string, unknown> = { on, set: { $value: bool ? false : 9 } };
  if (sourceValue) action.value = sourceValue;
  if (source === 'copy') {
    delete action.set;
    action.copy = '$source -> $value';
  }
  if (source === 'focused') action.target = 'dot';
  const doc = base(
    { value: { type: bool ? 'bool' : 'number' }, source: { type: 'number', default: 4 } },
    {
      requires: [
        'data',
        'bind',
        ...(source === 'focused' ? ['focus'] : source.startsWith('gamepad') ? ['input'] : []),
      ],
      nodes: [
        {
          id: 'dot',
          type: 'circle',
          center: [10, 10],
          r: 8,
          fill: { color: '#000' },
          ...(source === 'focused' ? { focus: {} } : {}),
        },
      ],
      listeners: [action],
    },
  );
  const actionScript =
    source === 'focused'
      ? 'focus target dot'
      : source.startsWith('gamepad')
        ? 'gamepads [{"index":0,"connected":true,"axes":[0],"buttons":[{"value":0,"pressed":false}]}]\ngamepads [{"index":0,"connected":true,"axes":[0.5],"buttons":[{"value":0.75,"pressed":true}]}]'
        : source === 'change'
          ? 'set $source 7\nadvance 0\nadvance 0'
          : 'pointer click 10 10';
  const values = ['initial', 'changed'].map((n) => ({
    $value: scalarValue(
      json(root + 'input/' + source + '/rive/frames/' + n + '.json').viewModel.properties,
      'n',
    ),
  }));
  verified[id] = {
    source: 'input/' + source + '/rive',
    doc,
    script: 'advance 0\nsnapshot $value\n' + actionScript + '\nsnapshot $value\n',
    values,
  };
}

for (const [kind, type, defaultValue] of [
  ['number', 'number', 7],
  ['boolean', 'bool', true],
  ['string', 'string', 'Ada'],
  ['color', 'color', '#11223344'],
  ['enum', 'enum', 'calm'],
] as const) {
  const value = scalarValue(
    json(root + 'custom/' + kind + '/rive/frames/initial.json').viewModel.properties,
    'value',
  );
  const prop = {
    type,
    default: defaultValue,
    ...(type === 'enum' ? { values: ['calm', 'happy'] } : {}),
  };
  verified['data.custom-property-' + kind] = {
    source: 'custom/' + kind + '/rive',
    doc: base(
      {
        value: {
          ...prop,
          default:
            type === 'number'
              ? 0
              : type === 'bool'
                ? false
                : type === 'color'
                  ? '#000'
                  : type === 'enum'
                    ? 'happy'
                    : '',
        },
      },
      {
        nodes: [
          {
            id: 'dot',
            type: 'circle',
            center: [10, 10],
            r: 1,
            fill: { color: '#000' },
            properties: { custom: prop },
          },
        ],
        bind: { 'dot.properties.custom': { value: '$value', mode: 'to-source' } },
      },
    ),
    script: 'advance 0\nsnapshot dot.properties.custom $value\n',
    values: [{ 'dot.properties.custom': value, $value: value }],
  };
}
verified['data.operation-operand-view-model'] = {
  source: 'arithmetic/rive',
  doc: base({ value: { type: 'number', default: 4 } }, { bind: { 'dot.x': '$value * 2' } }),
  script: 'advance 0\nsnapshot dot.x\nset $value 8\nadvance 0\nsnapshot dot.x\n',
  values: ['initial', 'changed'].map((n) => ({
    'dot.x': scalarValue(
      json(root + 'arithmetic/rive/frames/' + n + '.json').viewModel.properties,
      'observed',
    ),
  })),
};
verified['data.bind-conditions'] = {
  source: 'condition/rive',
  script: 'advance 0\nsnapshot dot.x\n',
  values: [
    {
      'dot.x': scalarValue(
        json(root + 'condition/rive/frames/initial.json').viewModel.properties,
        'observed',
      ),
    },
  ],
};
verified['drawing-paint.gradient-channel-binding'] = {
  source: 'gradient/rive',
  script:
    'advance 0\nsnapshot dot.fill.stops.0.red\nset $value 80\nadvance 0\nsnapshot dot.fill.stops.0.red\n',
  values: ['initial', 'changed'].map((n) => ({
    'dot.fill.stops.0.red': scalarValue(
      json(root + 'gradient/rive/frames/' + n + '.json').viewModel.properties,
      'red',
    ),
  })),
};
verified['data.property-trigger'] = {
  source: 'trigger/rive',
  doc: base(
    { pulse: { type: 'trigger' }, n: { type: 'number' } },
    { listeners: [{ on: 'change:$pulse', set: { $n: 9 } }] },
  ),
  script: 'advance 0\nsnapshot $n\nfire $pulse\nadvance 0\nadvance 0\nsnapshot $n\n',
  values: ['initial', 'changed'].map((n) => ({
    $n: scalarValue(json(root + 'trigger/rive/frames/' + n + '.json').viewModel.properties, 'n'),
  })),
};
for (const id of ['data.bind-instance-values', 'data.component-public-data'])
  verified[id] = {
    source: 'components/rive',
    script:
      'advance 0\nsnapshot a/dot.x b/dot.x\nset $value 7\nadvance 0\nsnapshot a/dot.x b/dot.x\n',
    values: ['initial', 'changed'].map((n) => {
      const d = json(root + 'components/rive/frames/' + n + '.json');
      return Object.fromEntries(
        d.nested.map(
          (x: {
            path: string;
            viewModels: { properties: { name: string; value: unknown }[] }[];
          }) => [
            x.path + '/dot.x',
            x.viewModels[0]!.properties.find((p) => p.name === 'observed')!.value,
          ],
        ),
      );
    }),
  };
verified['data.named-instances'] = {
  source: 'components/rive',
  doc: base(
    { value: { type: 'number' } },
    {
      data: {
        models: { Root: { properties: { value: { type: 'number' } } } },
        instances: {
          main: { model: 'Root', default: true, values: { value: 3 } },
          other: { model: 'Root', values: { value: 8 } },
        },
      },
    },
  ),
  script: 'advance 0\nsnapshot $main:value $other:value\n',
  values: [
    Object.fromEntries(
      json(root + 'components/rive/frames/initial.json').nested.map(
        (x: { viewModels: { name: string; properties: { name: string; value: unknown }[] }[] }) => [
          '$' + x.viewModels[0]!.name + ':value',
          x.viewModels[0]!.properties.find((p) => p.name === 'value')!.value,
        ],
      ),
    ),
  ],
};

verified['data.global-model'] = {
  source: 'global/rive',
  doc: base(
    {},
    {
      requires: ['data', 'bind', 'components'],
      data: {
        models: {
          Root: { properties: {} },
          Score: { global: true, properties: { value: { type: 'number', default: 3 } } },
          Local: { properties: { n: { type: 'number' } } },
        },
        instances: {
          root: { model: 'Root', default: true },
          g: { model: 'Score' },
          a: { model: 'Local' },
          b: { model: 'Local' },
        },
      },
      components: {
        badge: {
          grid: 20,
          data: 'Local',
          nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1, fill: { color: '#000' } }],
          bind: { 'dot.x': '$g:value' },
        },
      },
      nodes: [
        { id: 'a', type: 'instance', component: 'badge', data: 'a' },
        { id: 'b', type: 'instance', component: 'badge', data: 'b' },
      ],
    },
  ),
  script:
    'advance 0\nsnapshot a/dot.x b/dot.x $g:value\nset $g:value 7\nadvance 0\nsnapshot a/dot.x b/dot.x $g:value\n',
  values: ['initial', 'changed'].map((n) => {
    const d = json(root + 'global/rive/frames/' + n + '.json');
    return {
      ...Object.fromEntries(
        d.nested.map(
          (x: {
            path: string;
            viewModels: { properties: { name: string; value: unknown }[] }[];
          }) => [x.path + '/dot.x', x.viewModels[0]!.properties.find((p) => p.name === 'n')!.value],
        ),
      ),
      '$g:value': d.globals[0].properties.find((p: { name: string }) => p.name === 'value').value,
    };
  }),
};
const cases = json('tests/oracle/cases.json').filter(
  (c: { name: string }) =>
    !Object.hasOwn(verified, c.name.replace(/-/g, '.')) &&
    !Object.keys(verified)
      .map((id) => id.replaceAll('.', '-'))
      .includes(c.name),
);
for (const [id, probe] of Object.entries(verified)) {
  const slug = id.replaceAll('.', '-'),
    dir = 'tests/oracle/' + slug;
  mkdirSync(join(dir, 'rive/frames'), { recursive: true });
  if (probe.doc) {
    const text = decompile(probe.doc);
    const result = compile(text);
    if (!result.text || result.diagnostics.length) throw Error(JSON.stringify(result.diagnostics));
    writeFileSync(join(dir, 'case.animl'), text);
    writeFileSync(join(dir, 'case.ani'), result.text);
  } else
    for (const file of ['case.animl', 'case.ani'])
      copyFileSync('spec/conformance/' + slug + '/' + file, join(dir, file));
  for (const file of ['scene.rml', 'rive.yaml', 'commands.txt', 'session.txt'])
    copyFileSync(root + probe.source + '/' + file, join(dir, 'rive', file));
  for (const frame of ['initial', 'changed'].filter((n) =>
    existsSync(root + probe.source + '/frames/' + n + '.json'),
  ))
    copyFileSync(
      root + probe.source + '/frames/' + frame + '.json',
      join(dir, 'rive/frames', frame + '.json'),
    );
  writeFileSync(join(dir, 'script.txt'), probe.script);
  writeFileSync(
    join(dir, 'rive/observations.json'),
    JSON.stringify(
      probe.values.map((values, click) => ({ click, values, events: [] })),
      null,
      2,
    ) + '\n',
  );
  writeFileSync(
    join(dir, 'rive/README.md'),
    'Native raw-data oracle. Re-run from this directory with `/home/jarvis/.rive/bin/rive . --commands=commands.txt`.\nColor normalization maps native AARRGGBB to Anima #rrggbbaa. Nested slash/index paths map to dotted data paths.\n',
  );
  rmSync(join(dir, 'todo.json'), { force: true });
  cases.push({
    name: slug,
    times: [0],
    threshold: 0,
    maxOverPercent: 0,
    maxDiff: 0,
    observations: { script: 'script.txt', reference: 'rive/observations.json' },
  });
}

for (const [id, source, path, doc, script, frame] of [
  [
    'data.state-action-trigger',
    'state-trigger/rive',
    '$pulse',
    base(
      { pulse: { type: 'trigger' } },
      {
        machine: {
          layers: {
            m: { initial: 'idle', states: { idle: { pose: {}, entry: { fire: '$pulse' } } } },
          },
        },
      },
    ),
    'advance 0\n',
    'initial',
  ],
  [
    'data.custom-property-trigger',
    'custom-trigger/rive',
    'dot.properties.custom',
    base(
      {},
      {
        nodes: [
          {
            id: 'dot',
            type: 'circle',
            center: [10, 10],
            r: 1,
            fill: { color: '#000' },
            properties: { custom: { type: 'trigger' } },
          },
        ],
      },
    ),
    'fire dot.properties.custom\nadvance 0\n',
    'changed',
  ],
] as const) {
  const slug = id.replaceAll('.', '-'),
    dir = 'tests/oracle/' + slug;
  mkdirSync(join(dir, 'rive/frames'), { recursive: true });
  const xml = decompile(doc),
    result = compile(xml);
  if (!result.text || result.diagnostics.length) throw Error(JSON.stringify(result.diagnostics));
  writeFileSync(join(dir, 'case.animl'), xml);
  writeFileSync(join(dir, 'case.ani'), result.text);
  writeFileSync(join(dir, 'script.txt'), script);
  for (const file of ['scene.rml', 'rive.yaml', 'commands.txt', 'session.txt'])
    copyFileSync(root + source + '/' + file, join(dir, 'rive', file));
  copyFileSync(
    root + source + '/frames/' + frame + '.json',
    join(dir, 'rive/frames', frame + '.json'),
  );
  rmSync(join(dir, 'todo.json'), { force: true });
  const previous = cases.findIndex((c: { name: string }) => c.name === slug);
  if (previous >= 0) cases.splice(previous, 1);
  cases.push({
    name: slug,
    times: [0],
    threshold: 0,
    maxOverPercent: 0,
    maxDiff: 0,
    signals: {
      path,
      nativePath: 'pulse',
      reference: 'rive/frames/' + frame + '.json',
      script: 'script.txt',
    },
  });
}
writeFileSync('tests/oracle/cases.json', JSON.stringify(cases, null, 2) + '\n');
const implemented: string[] = json('modules/data/implemented.json');
const rows = json('modules/data/ROWS.json');
for (const row of rows) {
  if (
    Object.hasOwn(verified, row.id) ||
    ['data.state-action-trigger', 'data.custom-property-trigger'].includes(row.id)
  )
    row.status = 'verified';
  if (row.id.startsWith('data.property-asset-')) row.status = 'skip-evidenced';
  if (row.id === 'input.data-listener') row.status = 'finding';
  if (row.status === 'verified') row.oracle = 'tests/oracle/' + row.id.replaceAll('.', '-');
  if (row.status === 'skip-evidenced')
    row.oracle = 'tests/oracle/' + row.id.replaceAll('.', '-') + '/skip.json';
  else if (implemented.includes(row.id) && row.status === 'pending')
    row.status = 'implemented-awaiting-oracle';
  if (implemented.includes(row.id))
    row.conformance = 'spec/conformance/' + row.id.replaceAll('.', '-');
}
writeFileSync('modules/data/ROWS.json', JSON.stringify(rows, null, 2) + '\n');
console.log('Native oracle cases:', Object.keys(verified).length + 2);
