import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import '@anima-format/core/all';
import {
  COMMON,
  DOC,
  ELEMENTS,
  NODE_TYPES,
  OWN,
  PAINT,
  PAINTED,
  STATIC,
  jsonSchema,
  markupName,
  nodeShape,
  type Shape,
} from '@anima-format/core';
import { nodeAttrs } from '../../markup/src/names.ts';
import type { IO } from './cli.ts';

const ROOT = resolve(import.meta.dirname, '../../..');

const compact = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();

export function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next.push(Math.min(next[j]! + 1, row[j + 1]! + 1, row[j]! + Number(a[i] !== b[j])));
    row = next;
  }
  return row[b.length]!;
}

export function lookupTopic(topic: string | undefined, topics: string[], _command: string) {
  if (!topic) return topic;
  if (topics.includes(topic)) return topic;
  return (
    [...topics]
      .sort((a, b) => Number(b.includes('-')) - Number(a.includes('-')))
      .find((candidate) => compact(candidate) === compact(topic)) ?? topic
  );
}

function nearestTopic(topic: string, topics: readonly string[]): string | undefined {
  const key = compact(topic);
  const nearest = [...new Set(topics)]
    .map((candidate) => ({ candidate, d: distance(key, compact(candidate)) }))
    .sort((a, b) => a.d - b.d || a.candidate.localeCompare(b.candidate))[0];
  return nearest && nearest.d <= Math.max(2, Math.floor(key.length / 3))
    ? nearest.candidate
    : undefined;
}

const objectPaths: Record<string, string[]> = {
  fill: [],
  stroke: [],
  anima: [],
  meta: ['meta'],
  color: ['colors', '*'],
  glyph: ['glyphs', '*'],
  hit: ['hit'],
  timeline: ['timelines', '*'],
  track: ['timelines', '*', 'tracks'],
  event: ['timelines', '*', 'events', '*'],
  layer: ['machine', 'layers', '*'],
  state: ['machine', 'layers', '*', 'states', '*'],
  pose: ['machine', 'layers', '*', 'states', '*', 'pose'],
  ease: ['machine', 'layers', '*', 'states', '*', 'on', '*', 'ease'],
  on: ['machine', 'layers', '*', 'states', '*', 'on', '*'],
  bool: ['inputs', '*'],
  number: ['inputs', '*'],
  trigger: ['inputs', '*'],
  transition: ['machine', 'layers', '*', 'states', '*', 'on', '*'],
  listener: ['listeners', '*'],
  input: ['inputs', '*'],
};

function markupLabel(shape: Shape | undefined, key: string): string {
  const name = markupName(shape, key);
  if (name) return name;
  if (shape?.element === 'layout-item') return '(no attribute; use layout-* attributes)';
  if (shape?.element) return '(no attribute; use <' + shape.element + '>)';
  return '(no markup attribute)';
}

function objectPreview(shape: Extract<Shape, { k: 'obj' }>): string {
  const entries = Object.entries(shape.p);
  const shown = entries.slice(0, 6).map(([key, value]) => key + (value.k === 'arr' ? '[]' : ''));
  return '{ ' + shown.join(', ') + (entries.length > shown.length ? ', …' : '') + ' }';
}

function shortShape(shape: Shape): string {
  switch (shape.k) {
    case 'str':
      return shape.of ? shape.of.map((v) => JSON.stringify(v)).join(' | ') : 'string';
    case 'num':
      return 'number';
    case 'bool':
      return 'bool';
    case 'any':
      return 'any';
    case 'node':
      return 'node';
    case 'alt':
      return shape.of.map(shortShape).join(' | ');
    case 'tup':
      return '[' + shape.of.map(shortShape).join(', ') + ']';
    case 'map':
      return 'map<' + shortShape(shape.of) + '>';
    case 'arr':
      return shape.of.k === 'obj'
        ? objectPreview(shape.of) + '[]'
        : 'array<' + shortShape(shape.of) + '>';
    case 'obj':
      return objectPreview(shape);
  }
}

function shapeAt(path: string[], root: Shape = DOC): Shape {
  let shape = root;
  for (const key of path) {
    if (shape.k === 'obj') shape = shape.p[key]!;
    else if (shape.k === 'map' || shape.k === 'arr') shape = shape.of;
    else throw new Error('invalid schema registry path');
  }
  return shape;
}

type Field = {
  markup: string;
  ani: string;
  type: string;
  required: boolean;
  default?: unknown;
  feature?: string;
  description?: string;
  min?: number;
  details?: string;
};

function fields(path: string[], root: Shape = DOC, topicName?: string): Field[] {
  let shape = shapeAt(path, root);
  if (shape.k !== 'obj') {
    const p =
      shape.k === 'map'
        ? { '<address>': shape.of }
        : shape.k === 'tup'
          ? Object.fromEntries(shape.of.map((item, i) => [i === 0 ? 'at' : 'name', item]))
          : { [topicName === 'ease' ? 'curve' : 'value']: shape };
    shape = { k: 'obj', p };
  }
  return Object.entries(shape.p).map(([key, value]) => {
    const composite = value.k === 'obj' || (value.k === 'arr' && value.of.k === 'obj');
    return {
      markup: markupLabel(value, key),
      ani: key,
      type: shortShape(value),
      required: shape.req?.includes(key) ?? false,
      ...(value.default !== undefined ? { default: value.default } : {}),
      ...((value.feature ?? shape.feature) ? { feature: value.feature ?? shape.feature } : {}),
      ...(value.description ? { description: value.description } : {}),
      ...(value.k === 'num' && value.min !== undefined ? { min: value.min } : {}),
      ...(composite ? { details: topicName ? topicName + '.' + key : key } : {}),
    };
  });
}

const props = (
  rec: Record<
    string,
    { type: string; def?: unknown; min?: number; max?: number; feature?: string }
  >,
) =>
  Object.entries(rec).map(([name, prop]) => ({
    name,
    type: prop.type,
    default: prop.def ?? null,
    ...(prop.min !== undefined ? { min: prop.min } : {}),
    ...(prop.max !== undefined ? { max: prop.max } : {}),
    animatable: true,
    ...(prop.feature ? { feature: prop.feature } : {}),
  }));

const spellings = (type: (typeof NODE_TYPES)[number], paint?: string) =>
  nodeAttrs(type)
    .filter((attr) => (!paint || attr.path[0] === paint) && attr.attr !== attr.path.join('.'))
    .map((attr) => ({ markup: attr.attr, ani: attr.path.join('.') }));

function typeInfo(type: (typeof NODE_TYPES)[number]) {
  return {
    type,
    fields: fields([], nodeShape(type), type),
    spellings: spellings(type),
    animatable: props({ ...COMMON, ...OWN[type] } as never),
    static: [
      'id',
      'type',
      'pivot',
      ...Object.keys(STATIC[type]),
      ...(PAINTED.includes(type) ? ['fill', 'stroke', 'knockout'] : []),
    ],
  };
}

function schemaTopics(): string[] {
  const structural = [nodeShape('path').p, (DOC as Extract<Shape, { k: 'obj' }>).p].flatMap(
    (record) =>
      Object.entries(record)
        .filter(([, value]) => value.k === 'obj' || (value.k === 'arr' && value.of.k === 'obj'))
        .map(([key, value]) => markupName(value, key) || key),
  );
  return [
    ...new Set([
      ...NODE_TYPES,
      ...Object.keys(ELEMENTS),
      ...structural,
      ...Object.keys(objectPaths),
      'a11y',
      'fill',
      'stroke',
    ]),
  ].filter(Boolean);
}

export function schemaTopic(topic: string | undefined) {
  if (!topic) return topic;
  const form = Object.entries(ELEMENTS).find(([, candidate]) => candidate.values?.kind === topic);
  if (form) topic = form[0];
  const [head, ...tail] = topic.split('.');
  return [lookupTopic(head, schemaTopics(), 'schema'), ...tail].join('.');
}

function nodeFieldFor(topic: string): Shape | undefined {
  return (
    Object.entries(nodeShape('path').p).find(
      ([key, value]) => key === topic || markupName(value, key) === topic,
    )?.[1] ?? (DOC as Extract<typeof DOC, { k: 'obj' }>).p[topic]
  );
}

function schemaData(topic: string): unknown | undefined {
  const nodeField = nodeFieldFor(topic);
  const compositeField =
    nodeField &&
    (nodeField.k === 'arr' ? { ...nodeField.of, feature: nodeField.feature } : nodeField);
  const objectFields = Object.hasOwn(objectPaths, topic)
    ? fields(
        objectPaths[topic]!,
        topic === 'fill' || topic === 'stroke' ? nodeShape('path').p[topic]! : DOC,
        topic,
      )
    : ELEMENTS[topic]
      ? fields([], ELEMENTS[topic]!.shape, topic)
      : compositeField && compositeField.k === 'obj' && !NODE_TYPES.includes(topic as never)
        ? fields([], compositeField, topic)
        : undefined;

  if (topic === 'a11y')
    return {
      topic,
      scope: 'node.a11y',
      fields: fields([], nodeShape('path').p.a11y, topic),
      actions: ['tap', 'increase', 'decrease', 'focus'],
      root: { scope: 'doc.a11y (root icon semantics)', fields: fields(['a11y'], DOC, topic) },
    };
  if (objectFields)
    return {
      topic,
      fields: objectFields,
      ...(topic === 'fill' || topic === 'stroke'
        ? {
            [topic]: props(PAINT[topic] as never),
            spellings: spellings('path', topic),
            static: objectFields
              .filter((field) => !(field.ani in PAINT[topic]))
              .map((field) => field.ani),
          }
        : {}),
    };
  if ((NODE_TYPES as readonly string[]).includes(topic))
    return typeInfo(topic as (typeof NODE_TYPES)[number]);
  return undefined;
}

function allSchemaData() {
  return {
    nodeTypes: NODE_TYPES.map(typeInfo),
    paint: { fill: props(PAINT.fill as never), stroke: props(PAINT.stroke as never) },
    paintFields: {
      fill: fields([], nodeShape('path').p.fill, 'fill'),
      stroke: fields([], nodeShape('path').p.stroke, 'stroke'),
    },
  };
}

function topicFeature(topic: string, data: { fields?: Field[] } | undefined): string {
  if ((NODE_TYPES as readonly string[]).includes(topic)) return 'core';
  if (topic === 'fill' || topic === 'stroke') return 'core';
  const features = new Set<string>();
  const take = (feature: unknown) => {
    for (const name of String(feature ?? '').split('|')) if (name) features.add(name);
  };
  take(ELEMENTS[topic]?.shape.feature);
  for (const field of data?.fields ?? []) take(field.feature);
  if (!features.size) take(nodeFieldFor(topic)?.feature);
  return [...features].sort().join(', ') || 'core';
}

function exampleFiles(): string[] {
  const result: string[] = [];
  const visit = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (
        entry.isFile() &&
        entry.name.endsWith('.animl') &&
        (path.includes('/examples/') || path.includes('/capabilities/'))
      )
        result.push(relative(ROOT, path));
    }
  };
  visit(resolve(ROOT, 'examples'));
  visit(resolve(ROOT, 'modules'));
  return result.sort();
}

let cachedExamples: { path: string; text: string }[] | undefined;
function examplesFor(topic: string, feature: string): string[] {
  cachedExamples ??= exampleFiles().map((path) => ({
    path,
    text: readFileSync(resolve(ROOT, path), 'utf8'),
  }));
  const terms = new Set([topic, ...feature.split(/,\s*/).filter((name) => name !== 'core')]);
  const matches = cachedExamples.filter(({ path, text }) => {
    for (const term of terms) {
      if (path.startsWith('modules/' + term + '/')) return true;
      if (text.toLowerCase().includes('<' + term.toLowerCase())) return true;
      if (text.toLowerCase().includes(term.toLowerCase())) return true;
    }
    return false;
  });
  return matches.slice(0, 3).map((entry) => entry.path);
}

function metadata(topic: string, data: unknown): string {
  const page = data as { fields?: Field[] } | undefined;
  const requires = topicFeature(topic, page);
  const examples = examplesFor(topic, requires);
  return [
    'Requires: ' + requires,
    'Docs: anima docs ' + topic,
    'Examples: ' + (examples.length ? examples.join(', ') : '(none found)'),
  ].join('\n');
}

function fieldLine(field: Field, prefix = ''): string {
  return (
    '  ' +
    field.markup +
    ' ↔ ' +
    prefix +
    field.ani +
    ': ' +
    field.type +
    (field.required ? ' (required)' : '') +
    ('default' in field ? ' (default ' + JSON.stringify(field.default) + ')' : '') +
    (field.feature ? ' [' + field.feature + ']' : '') +
    (field.description ? ' — ' + field.description : '') +
    (field.details ? '; details: anima schema ' + field.details : '')
  );
}

function table(
  rows: {
    name: string;
    type: string;
    default: unknown;
    min?: number;
    max?: number;
    feature?: string;
  }[],
): string {
  return rows
    .map(
      (row) =>
        '  ' +
        row.name.padEnd(12) +
        ' ' +
        row.type.padEnd(7) +
        ' default ' +
        JSON.stringify(row.default) +
        (row.min !== undefined || row.max !== undefined
          ? '  range [' + (row.min ?? '-∞') + ', ' + (row.max ?? '∞') + ']'
          : '') +
        (row.feature ? ' [' + row.feature + ']' : ''),
    )
    .join('\n');
}

const mapping = (rows: { markup: string; ani: string }[]) =>
  rows.map((row) => '  ' + row.markup + ' ↔ ' + row.ani).join('\n');

function showType(data: ReturnType<typeof typeInfo>): string {
  return (
    data.type +
    '\n attributes (markup ↔ .ani: type)\n' +
    data.fields.map((field) => fieldLine(field)).join('\n') +
    '\n animatable (address: <id>.<property>)\n' +
    table(data.animatable) +
    '\n not animatable: ' +
    data.static.join(', ') +
    '\n markup ↔ .ani\n' +
    mapping(data.spellings) +
    '\n module fields\n' +
    data.fields
      .filter((field) => field.feature)
      .map((field) => '  ' + field.ani + ' [' + field.feature + ']')
      .join('\n') +
    '\n' +
    metadata(data.type, data)
  );
}

function showObject(topic: string, data: { fields: Field[] }): string {
  const prefix = topic === 'fill' || topic === 'stroke' ? topic + '.' : '';
  let text =
    topic +
    ' (markup ↔ .ani: type)\n' +
    (data.fields as Field[]).map((field) => fieldLine(field, prefix)).join('\n');
  if (topic === 'fill' || topic === 'stroke')
    text +=
      '\n animatable (address: <id>.' + topic + '.<field>)\n' + table(props(PAINT[topic] as never));
  return text + '\n' + metadata(topic, data);
}

function schemaMiss(topic: string, io: IO, json = false): number {
  const suggestion = nearestTopic(topic.split('.')[0]!, schemaTopics());
  if (json) {
    const suggestions = suggestion ? [suggestion] : [];
    io.err(
      JSON.stringify({
        error: `no schema topic "${topic}"`,
        suggestions,
        help: 'anima help schema',
      }),
    );
    return 2;
  }
  io.err(
    suggestion
      ? 'no schema topic "' +
          topic +
          '"; did you mean "' +
          suggestion +
          '"? Try anima schema ' +
          suggestion +
          "\nSee 'anima schema --help'."
      : 'no schema topic "' + topic + "\"\nSee 'anima schema --help'.",
  );
  return 2;
}

function topicIndex(json: boolean, io: IO): number {
  const base = new Set<string>(NODE_TYPES);
  const rows = schemaTopics()
    .map((topic) => ({
      topic,
      kind: base.has(topic) ? 'node' : 'object',
      summary: base.has(topic)
        ? topic + ' node fields, animation addresses and markup spellings'
        : topic + ' object/element fields and markup spellings',
      open: 'anima schema ' + topic,
    }))
    .sort(
      (a, b) =>
        Number(a.kind !== 'node') - Number(b.kind !== 'node') || a.topic.localeCompare(b.topic),
    );
  io.out(
    json
      ? JSON.stringify({ topics: rows })
      : rows.map((row) => row.topic + '\t' + row.summary + '; open: ' + row.open).join('\n'),
  );
  return 0;
}

export function schema(topic: string | undefined, full: boolean, json: boolean, io: IO): number {
  if (full) {
    io.out(JSON.stringify(jsonSchema(), null, 2));
    return 0;
  }
  if (!topic) return topicIndex(json, io);

  if (topic.includes('.')) {
    const [head, ...path] = topic.split('.');
    const canonical = schemaTopic(head)!;
    const data = schemaData(canonical) as { fields?: Field[] } | undefined;
    if (!data) return schemaMiss(topic, io, json);
    const key = path.join('.');
    const field = data.fields?.find(
      (candidate: { ani: string; markup: string }) =>
        candidate.ani === key || candidate.markup === key,
    );
    if (!field) {
      if (json)
        io.err(
          JSON.stringify({
            error: `unknown schema field ${topic}`,
            suggestions: [],
            help: `anima schema ${canonical}`,
          }),
        );
      else io.err('unknown schema field ' + topic + "\nSee 'anima schema " + canonical + "'.");
      return 2;
    }
    io.out(JSON.stringify({ topic, ...field }));
    return 0;
  }

  topic = schemaTopic(topic);
  const data = topic ? schemaData(topic) : undefined;
  if (!topic || !data) return schemaMiss(topic ?? '', io, json);
  if (json) {
    io.out(JSON.stringify(data));
    return 0;
  }

  if (topic === 'a11y') {
    const a11y = data as { fields: Field[]; root: { fields: Field[] } };
    const rows = (a11y.fields as Field[]).map((field) => fieldLine(field)).join('\n');
    const rootRows = (a11y.root.fields as Field[]).map((field) => fieldLine(field)).join('\n');
    io.out(
      'node.a11y (node semantics; markup ↔ .ani: type)\n' +
        rows +
        '\nActions: tap, increase, decrease, focus\n\ndoc.a11y (root icon semantics; markup ↔ .ani: type)\n' +
        rootRows +
        '\n' +
        metadata(topic, data),
    );
    return 0;
  }
  if ((NODE_TYPES as readonly string[]).includes(topic))
    io.out(showType(data as ReturnType<typeof typeInfo>));
  else io.out(showObject(topic, data as { fields: Field[] }));
  return 0;
}

export function schemaAll(json: boolean, io: IO): number {
  if (json) {
    io.out(JSON.stringify(allSchemaData()));
    return 0;
  }
  const pages = schemaTopics()
    .map((topic) => {
      const data = schemaData(topic);
      if (!data) return '';
      return (NODE_TYPES as readonly string[]).includes(topic)
        ? showType(data as ReturnType<typeof typeInfo>)
        : showObject(topic, data as { fields: Field[] });
    })
    .filter(Boolean);
  io.out(pages.join('\n\n'));
  return 0;
}

export function schemaSearch(words: string, json: boolean, io: IO): number {
  if (!words.trim()) {
    io.err("--search needs at least one word\nSee 'anima schema --help'.");
    return 2;
  }
  const entries: { name: string; description: string; kind: string }[] = [];
  for (const topic of schemaTopics()) {
    const data = schemaData(topic) as { fields?: Field[] } | undefined;
    if (!data) continue;
    entries.push({ name: topic, description: 'registry topic ' + topic, kind: 'type' });
    for (const field of data.fields ?? []) {
      if (field.markup !== field.ani)
        entries.push({
          name: topic + '.' + field.markup,
          description: [field.description, field.type, field.ani].filter(Boolean).join(' '),
          kind: 'field',
        });
      entries.push({
        name: topic + '.' + field.ani,
        description: [field.description, field.type, field.markup].filter(Boolean).join(' '),
        kind: 'field',
      });
    }
  }
  const spec = readFileSync(resolve(ROOT, 'spec/SPEC.md'), 'utf8');
  for (const match of spec.matchAll(/^\| \x60([^\x60]+)\x60 \| (?:error|warning) \| (.+) \|$/gm))
    entries.push({ name: match[1]!, description: match[2]!, kind: 'diagnostic' });
  const terms = words.toLowerCase().trim().split(/\s+/);
  const results = entries
    .map((entry) => ({
      ...entry,
      score: terms.reduce(
        (score, term) =>
          score +
          (entry.name.toLowerCase() === term
            ? 100
            : entry.name.toLowerCase().includes(term)
              ? 10
              : entry.description.toLowerCase().includes(term)
                ? 1
                : 0),
        0,
      ),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  io.out(
    json
      ? JSON.stringify({ results })
      : results
          .map((entry) => entry.name + '\t' + entry.kind + '\t' + entry.description)
          .join('\n'),
  );
  return 0;
}

export function filteredSchema(
  topic: string | undefined,
  options: Record<string, unknown>,
  json: boolean,
  io: IO,
): number {
  if (options['editor-only']) {
    const result = { applicable: false, reason: 'Anima has no editor-only entries', fields: [] };
    io.out(json ? JSON.stringify(result) : result.reason);
    return 0;
  }
  topic = schemaTopic(topic);
  type Row = {
    ani: string;
    name?: string;
    animatable: boolean;
    bindable: boolean;
    inherited: boolean;
    type: string;
  };
  const nodeRows = (
    type: (typeof NODE_TYPES)[number],
    info: { fields: { ani: string; type: string }[] },
  ) =>
    info.fields.map((field) => {
      const prop = COMMON[field.ani] ?? OWN[type][field.ani];
      return {
        ...field,
        animatable: !!prop,
        bindable: !!prop,
        inherited: Object.hasOwn(COMMON, field.ani),
      };
    });

  let rows: Row[];
  if (!topic)
    rows = NODE_TYPES.flatMap((type) =>
      nodeRows(type, typeInfo(type)).map((field) => ({ ...field, ani: type + '.' + field.ani })),
    );
  else if (NODE_TYPES.includes(topic as never))
    rows = nodeRows(topic as never, typeInfo(topic as never));
  else if (topic.includes('.')) {
    const [type, key] = topic.split('.');
    if (!NODE_TYPES.includes(type as never)) return schemaMiss(topic, io, json);
    const data = schemaData(type) as ReturnType<typeof typeInfo>;
    const field = data.fields.find(
      (candidate) => candidate.ani === key || candidate.markup === key,
    );
    if (!field) return schemaMiss(topic, io, json);
    rows = nodeRows(type as never, { fields: [field] });
  } else {
    const data = schemaData(topic) as { fields?: Row[] } | undefined;
    if (!data) return schemaMiss(topic, io, json);
    rows = (data.fields ?? []).map((field: Row) => ({
      ...field,
      animatable: !!PAINT[topic as 'fill']?.[field.ani],
      bindable: !!PAINT[topic as 'fill']?.[field.ani],
      inherited: false,
    }));
  }

  const result = rows.filter(
    (field) =>
      (!options.animatable || field.animatable) &&
      (!options.bindable || field.bindable) &&
      (!options.inherited || field.inherited),
  );
  io.out(
    json
      ? JSON.stringify({ topic, fields: result })
      : result
          .map(
            (field) =>
              field.ani +
              ': ' +
              field.type +
              '; animatable=' +
              field.animatable +
              ' bindable=' +
              field.bindable +
              ' inherited=' +
              field.inherited,
          )
          .join('\n'),
  );
  return 0;
}
