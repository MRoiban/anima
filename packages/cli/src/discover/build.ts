/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '@anima-format/core/all';
import {
  NODE_TYPES,
  ELEMENTS,
  nodeShape,
  jsonSchema,
  markupName,
  DOC,
  COMMON,
  OWN,
  PAINT,
  PAINTED,
  type Shape,
} from '@anima-format/core';
import type { Entry } from './api.ts';
import { SYNONYMS } from './synonyms.ts';
import { COMMANDS } from '../commands.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const READ_CACHE = new Map<string, string>();
const FILE_CACHE = new Map<string, string[]>();
const HEADING_CACHE = new Map<string, { title: string; level: number }[]>();
const read = (p: string) => {
  let text = READ_CACHE.get(p);
  if (text === undefined) {
    text = fs.readFileSync(path.join(ROOT, p), 'utf8');
    READ_CACHE.set(p, text);
  }
  return text;
};
const exists = (p: string) => fs.existsSync(path.join(ROOT, p));
const uniq = (a: string[]) => [...new Set(a.filter(Boolean))];
const firstSentence = (s: string) =>
  s
    .replace(/[`*_#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s/)[0] || '';
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const docSlug = (s: string) => slug(s).replace(/^[0-9]+(?:-[0-9]+)*-/, '');

function allFiles(dir: string): string[] {
  const cached = FILE_CACHE.get(dir);
  if (cached) return cached;
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...allFiles(rel));
    else out.push(rel.replaceAll('\\', '/'));
  }
  FILE_CACHE.set(dir, out);
  return out;
}
const files = (dir: string, pred: (p: string) => boolean) => allFiles(dir).filter(pred);
function headings(file: string) {
  const cached = HEADING_CACHE.get(file);
  if (cached) return cached;
  if (!exists(file)) return [] as { title: string; level: number }[];
  const value = read(file)
    .split(/\r?\n/)
    .flatMap((l) => {
      const m = /^(#{2,3})\s+(.+)$/.exec(l);
      return m ? [{ title: m[2].replace(/\s+#+$/, '').trim(), level: m[1].length }] : [];
    });
  HEADING_CACHE.set(file, value);
  return value;
}

let SPEC_MODULE_SUMMARIES: Map<string, string> | undefined;
function specModuleSummaries(): Map<string, string> {
  if (SPEC_MODULE_SUMMARIES) return SPEC_MODULE_SUMMARIES;
  const text = read('spec/SPEC.md');
  const chapters = [...text.matchAll(/^## ([a-z][a-z0-9-]*)\s*$/gm)];
  const map = new Map<string, string>();
  for (let i = 0; i < chapters.length; i++) {
    const match = chapters[i]!;
    const body = text
      .slice(match.index! + match[0].length, chapters[i + 1]?.index ?? text.length)
      .replace(/^\s*<!--.*?-->\s*/s, '')
      .trim();
    const paragraph = body.split(/\n\s*\n/).find((part) => part && !part.startsWith('#'));
    if (paragraph) map.set(match[1]!, firstSentence(paragraph));
  }
  SPEC_MODULE_SUMMARIES = map;
  return map;
}

function docsEntries(): Entry[] {
  const out: Entry[] = [];
  const add = (name: string, args: string[], summary = name) =>
    out.push({ kind: 'doc', name, summary, docs: [args.join(' ')] });
  add('spec', ['spec'], 'Anima format specification');
  add('authoring', ['authoring'], 'Anima authoring guide');
  add('markup', ['markup'], 'AniML markup guide');
  for (const [file, prefix] of [
    ['spec/SPEC.md', 'spec'],
    ['docs/AUTHORING.md', 'authoring'],
    ['docs/MARKUP.md', 'markup'],
  ] as const) {
    for (const h of headings(file)) {
      if (h.level < 2) continue;
      add(`${prefix}.${docSlug(h.title)}`, [prefix, docSlug(h.title)], h.title);
    }
  }
  for (const d of fs
    .readdirSync(path.join(ROOT, 'modules'), { withFileTypes: true })
    .filter((e) => e.isDirectory())) {
    const n = d.name;
    if (exists(`modules/${n}/SPEC.md`)) {
      add(n, [n], `${n} module specification`);
      for (const h of headings(`modules/${n}/SPEC.md`))
        add(`${n}.${docSlug(h.title)}`, [n, docSlug(h.title)], h.title);
    }
  }
  return out;
}
type ExampleRaw = { path: string; requires: string[]; names: string[]; summary: string };
let EXAMPLES: ExampleRaw[] | undefined;
function examplesRaw(): ExampleRaw[] {
  if (EXAMPLES) return EXAMPLES;
  const ps = uniq([
    ...files('examples', (p) => /\.(?:ani|animl)$/.test(p)),
    ...files('modules', (p) =>
      /(?:\/examples\/.*\.(?:ani|animl)$|\/capabilities\/[^/]+\/example\.animl$)/.test(p),
    ),
  ]);
  const inventory = parityRows();
  const byCapabilitySlug = new Map(
    inventory.map((r) => [String(r.id).replaceAll('.', '-'), r] as const),
  );
  EXAMPLES = ps.map((p) => {
    const text = read(p);
    let requires: string[] = [],
      names: string[] = [];
    let summary = '';
    if (p.endsWith('.ani'))
      try {
        const j = JSON.parse(text);
        requires = j.requires || [];
        summary = j.name || j.title || '';
        const walk = (x: any) => {
          if (Array.isArray(x)) x.forEach(walk);
          else if (x && typeof x === 'object') {
            if (typeof x.type === 'string') names.push(x.type);
            Object.values(x).forEach(walk);
          }
        };
        walk(j);
      } catch {}
    else {
      const rm =
        /\brequires\s*=\s*["']([^"']+)/.exec(text) || /\brequires\s*:\s*([^\n>]+)/.exec(text);
      if (rm) requires = rm[1].trim().split(/[\s,]+/);
      names = [...text.matchAll(/<([a-z][\w-]*)\b/g)].map((m) => m[1]);
      const cm = /^\s*<!--\s*([^>]+?)\s*-->/s.exec(text);
      summary = cm?.[1]?.replace(/\s+/g, ' ') || '';
    }
    const cap = /\/capabilities\/([^/]+)\/example\.animl$/.exec(p)?.[1];
    const row = cap ? byCapabilitySlug.get(cap) : undefined;
    if (row) summary = firstSentence(`${row.capability || ''}. ${row.what || ''}`);
    return {
      path: p,
      requires: uniq(requires),
      names: uniq(names),
      summary: summary || path.basename(p),
    };
  });
  return EXAMPLES;
}
type FeatureMeta = { after: string[]; summary: string; module: string };
let FEATURES: Map<string, FeatureMeta> | undefined;
function moduleSummary(module: string, fallback: string): string {
  const fromSpec = specModuleSummaries().get(module);
  if (fromSpec) return fromSpec;
  const own = `modules/${module}/SPEC.md`;
  if (exists(own)) {
    const body = read(own).replace(/^#.*$/m, '').trim();
    const paragraph = body.split(/\n\s*\n/).find((p) => p && !p.startsWith('#'));
    if (paragraph) return firstSentence(paragraph);
  }
  return fallback;
}
function featureMap(): Map<string, FeatureMeta> {
  if (FEATURES) return FEATURES;
  const m = new Map<string, { after: string[]; summary: string; module: string }>();
  for (const f of files('modules', (p) => /\/manifest\.ts$/.test(p))) {
    const t = read(f);
    const mod = f.split('/')[1];
    const name = /\bname:\s*['"]([^'"]+)/.exec(t)?.[1] || mod;
    const canonical = name.replaceAll('-', '');
    const exportedAfter = /export const after(?:\s*:\s*[^=]+)?\s*=\s*\[([^\]]*)\]/s.exec(t)?.[1];
    const afterSource = exportedAfter ?? /after:\s*\[([^\]]*)\]/s.exec(t)?.[1] ?? '';
    const after = [...afterSource.matchAll(/['"]([^'"]+)/g)].map((y) => y[1].replaceAll('-', ''));
    const sum = moduleSummary(mod, `${name} feature`);
    m.set(canonical, { after: uniq(after), summary: sum, module: mod });
  }
  FEATURES = m;
  return FEATURES;
}
function schemaEntries(
  features: Map<string, { after: string[]; summary: string; module: string }>,
  ex: ExampleRaw[],
): Entry[] {
  const out: Entry[] = [];
  const featureFor = (name: string) => {
    for (const [f, v] of features)
      if (v.module === name || v.module.replaceAll('-', '') === name.replaceAll('-', '')) return f;
    return undefined;
  };
  for (const [f, v] of features)
    out.push({
      kind: 'feature',
      name: f,
      summary: v.summary,
      aliases: uniq([v.module, v.module.replaceAll('-', '')]),
      docs:
        exists(`modules/${v.module}/SPEC.md`) ||
        headings('spec/SPEC.md').some((h) => slug(h.title) === v.module)
          ? [v.module]
          : undefined,
      examples: ex
        .filter((e) => e.requires.map((r) => r.replaceAll('-', '')).includes(f))
        .map((e) => e.path),
    });

  const seenFields = new Set<string>();
  const addField = (topic: string, key: string, shape: Shape, feature?: string, prefix = '') => {
    const ani = prefix ? `${prefix}.${key}` : key;
    const markup = markupName(shape, key);
    const name = `${topic}.${ani}`;
    if (!seenFields.has(name)) {
      seenFields.add(name);
      out.push({
        kind: 'field',
        name,
        summary: shape.description || `${ani} field of ${topic}`,
        aliases: uniq([`${topic}.${prefix ? prefix + '.' : ''}${markup}`, markup, ani]),
        feature: shape.feature || feature,
        schema: topic,
      });
    }
    const next = prefix ? `${prefix}.${key}` : key;
    if (shape.k === 'obj')
      for (const [k, v] of Object.entries(shape.p))
        addField(topic, k, v, shape.feature || feature, next);
    else if ((shape.k === 'arr' || shape.k === 'map') && shape.of.k === 'obj')
      for (const [k, v] of Object.entries(shape.of.p))
        addField(topic, k, v, shape.feature || feature, next);
  };

  for (const n of NODE_TYPES) {
    const sh = nodeShape(n);
    const typeFeature = sh.p.type?.feature || featureFor(n);
    const mk = markupName(sh, n);
    out.push({
      kind: 'type',
      name: n,
      summary: `${n} node type`,
      aliases: mk !== n ? [mk] : undefined,
      feature: typeFeature,
      schema: n,
      examples: ex.filter((e) => e.names.includes(n) || e.names.includes(mk)).map((e) => e.path),
    });
    for (const [k, v] of Object.entries(sh.p)) addField(n, k, v, typeFeature);
    for (const [k, prop] of Object.entries({ ...COMMON, ...OWN[n] }))
      out.push({
        kind: 'address',
        name: `<id>.${k}`,
        summary: `Animatable ${k} address on ${n}`,
        aliases: [`${n}.${k}`],
        feature: prop.feature || typeFeature,
        schema: n,
      });
    if (PAINTED.includes(n))
      for (const [paint, rec] of Object.entries(PAINT))
        for (const [k, prop] of Object.entries(rec))
          out.push({
            kind: 'address',
            name: `<id>.${paint}.${k}`,
            summary: `Animatable ${paint}.${k} address on ${n}`,
            aliases: [`${n}.${paint}.${k}`],
            feature: prop.feature || typeFeature,
            schema: n,
          });
  }
  // The schema view exposes composite node fields (stroke, fill, a11y, …) as their own topics.
  // Derive those object topics from the same path-node registry rather than copying a topic list.
  for (const [k, v] of Object.entries(nodeShape('path').p)) {
    const nested =
      v.k === 'obj' ? v : (v.k === 'arr' || v.k === 'map') && v.of.k === 'obj' ? v.of : undefined;
    if (!nested) continue;
    const topic = markupName(v, k) || k;
    out.push({
      kind: 'type',
      name: topic,
      summary: `${topic} object type`,
      feature: v.feature || nested.feature,
      schema: topic,
    });
    for (const [child, shape] of Object.entries(nested.p))
      addField(topic, child, shape, v.feature || nested.feature);
  }

  const doc = DOC as Extract<Shape, { k: 'obj' }>;
  for (const [k, v] of Object.entries(doc.p)) {
    addField('document', k, v, v.feature);
    const nested =
      v.k === 'obj' ? v : (v.k === 'arr' || v.k === 'map') && v.of.k === 'obj' ? v.of : undefined;
    if (nested) {
      const marked = markupName(v, k);
      const topic = marked && marked !== k ? marked : k.replace(/s$/, '');
      out.push({
        kind: 'type',
        name: topic,
        summary: `${topic} object type`,
        feature: v.feature || nested.feature,
        schema: topic,
      });
      for (const [child, shape] of Object.entries(nested.p))
        addField(topic, child, shape, v.feature || nested.feature);
    }
  }
  for (const [n, form] of Object.entries(ELEMENTS)) {
    const objectType = form.values?.kind;
    const feat =
      form.shape.feature || featureFor(n) || (objectType ? featureFor(objectType) : undefined);
    if (objectType)
      out.push({
        kind: 'type',
        name: objectType,
        summary: `${objectType} object type`,
        aliases: objectType === n ? undefined : [n],
        feature: feat,
        schema: n,
        examples: ex.filter((e) => e.names.includes(n)).map((e) => e.path),
      });
    out.push({
      kind: 'element',
      name: n,
      summary: `<${n}> AniML element`,
      aliases: [`<${n}>`],
      feature: feat,
      schema: n,
      examples: ex.filter((e) => e.names.includes(n)).map((e) => e.path),
    });
    for (const [k, v] of Object.entries(form.shape.p)) addField(n, k, v, feat);
    if (objectType && form.target?.default) {
      const base = `<target>.${form.target.default}${form.target.array ? '.<index>' : ''}`;
      for (const [k, v] of Object.entries(form.shape.p))
        if (v.k === 'num' && !v.int)
          out.push({
            kind: 'address',
            name: `${base}.${k}`,
            summary: `Bindable ${k} address for ${objectType}`,
            aliases: [`${objectType}.${k}`],
            feature: feat,
            schema: n,
          });
    }
  }
  void jsonSchema;
  return out;
}
function vocabEntries(): Entry[] {
  const out: Entry[] = [];
  for (const n of ['linear', 'hold', 'in', 'out', 'inOut', 'cubic', 'elastic'])
    out.push({
      kind: 'ease',
      name: n,
      summary: `${n} easing`,
      aliases: n === 'inOut' ? ['in-out'] : undefined,
    });
  for (const [n, a] of Object.entries({
    min: 2,
    max: 2,
    clamp: 3,
    mix: 3,
    floor: 1,
    mod: 2,
    contains: 2,
    lower: 1,
  }))
    out.push({
      kind: 'function',
      name: n,
      summary: `Expression function ${n}(${Array(a).fill('…').join(', ')})`,
      feature: 'bind',
    });
  if (exists('modules/bind/core/expression.ts'))
    for (const m of read('modules/bind/core/expression.ts').matchAll(
      /registerFunction\(\s*['"]([^'"]+)/g,
    ))
      out.push({
        kind: 'function',
        name: m[1],
        summary: `Registered expression function ${m[1]}`,
        feature: 'bind',
      });
  if (exists('modules/input/core/types.ts')) {
    const block =
      /export const events\s*=\s*\[([\s\S]*?)\]/.exec(read('modules/input/core/types.ts'))?.[1] ||
      '';
    for (const m of block.matchAll(/['"]([^'"]+)/g))
      out.push({
        kind: 'event',
        name: m[1],
        summary: `Input listener event ${m[1]}`,
        feature: 'input',
      });
  }
  for (const f of uniq([
    'packages/core/src/script.ts',
    ...files('modules', (p) => /\/core\/commands\.ts$/.test(p)),
  ])) {
    const t = read(f);
    for (const m of t.matchAll(
      /(?:case\s+|command\s*===\s*|command\s*!==\s*)['"]([a-z][\w-]*)['"]/g,
    ))
      out.push({
        kind: 'script',
        name: m[1],
        summary: `sample/session script command ${m[1]}`,
        feature: f.startsWith('modules/') ? f.split('/')[1]!.replaceAll('-', '') : undefined,
      });
  }
  if (exists('spec/SPEC.md'))
    for (const l of read('spec/SPEC.md').split(/\r?\n/)) {
      const m = /^\| `([^`]+)` \| (?:error|warning) \| (.+) \|$/.exec(l);
      if (m) out.push({ kind: 'diagnostic', name: m[1], summary: m[2] });
    }
  return out;
}
function commandEntries(): Entry[] {
  return COMMANDS.map(({ name, summary, aliases, group, options }) => ({
    kind: 'command' as const,
    name,
    summary,
    aliases: uniq([
      'command',
      group,
      ...(aliases || []),
      ...options.flatMap((option) => [option.name, option.short || '', ...(option.choices || [])]),
    ]),
  }));
}

type ParityRow = {
  id: string;
  capability?: string;
  what?: string;
  anima?: { status?: string; module?: string; construct?: string };
};
let PARITY: ParityRow[] | undefined;
function parityRows(): ParityRow[] {
  if (PARITY) return PARITY;
  const inv = JSON.parse(read('docs/parity/inventory.json'));
  PARITY = Array.isArray(inv) ? inv : inv.rows || inv.capabilities || [];
  return PARITY!;
}

function capabilityEntries(base: Entry[], ex: ExampleRaw[]): Entry[] {
  const rows = parityRows();
  const out: Entry[] = [];
  const rowsByTitle = new Map<string, string[]>();
  for (const row of rows) {
    if (row?.anima?.status !== 'done') continue;
    const key = slug(row.capability || '');
    const slot = rowsByTitle.get(key) ?? [];
    slot.push(row.id);
    rowsByTitle.set(key, slot);
  }
  const examplesByFeature = new Map<string, ExampleRaw[]>();
  const examplesByCapability = new Map<string, ExampleRaw[]>();
  for (const e of ex) {
    for (const req of e.requires) {
      const f = req.replaceAll('-', '');
      const slot = examplesByFeature.get(f) ?? [];
      slot.push(e);
      examplesByFeature.set(f, slot);
    }
    const cap = /\/capabilities\/([^/]+)\/example\.animl$/.exec(e.path)?.[1];
    if (cap) {
      const slot = examplesByCapability.get(cap) ?? [];
      slot.push(e);
      examplesByCapability.set(cap, slot);
    }
  }
  const entriesByFeature = new Map<string, Entry[]>();
  const entriesByName = new Map<string, Entry[]>();
  for (const e of base) {
    if (e.feature) {
      const slot = entriesByFeature.get(e.feature) ?? [];
      slot.push(e);
      entriesByFeature.set(e.feature, slot);
    }
    const slot = entriesByName.get(e.name) ?? [];
    slot.push(e);
    entriesByName.set(e.name, slot);
  }
  const rowsByFeature = new Map<string, string[]>();
  const exampleEntries = base.filter((entry) => entry.examples?.length);
  for (const r of rows) {
    if (r?.anima?.status !== 'done') continue;
    const feature = (r.anima.module || '').replaceAll('-', '');
    const featureRows = rowsByFeature.get(feature) ?? [];
    featureRows.push(r.id);
    rowsByFeature.set(feature, featureRows);
    const capKeys = [r.id, r.id.replaceAll('.', '-'), r.id.split('.').at(-1)!];
    const exact = uniq(
      capKeys.flatMap((key) => (examplesByCapability.get(key) ?? []).map((e) => e.path)),
    );
    const related = examplesByFeature.get(feature) || [];
    const construct = String(r.anima.construct || '').toLowerCase();
    const inferred = construct
      ? exampleEntries.flatMap((entry) =>
          construct.includes(entry.name.toLowerCase()) ? entry.examples || [] : [],
        )
      : [];
    out.push({
      kind: 'capability',
      name: r.id,
      summary: firstSentence(`${r.capability || ''}. ${r.what || ''}`),
      feature: feature || undefined,
      docs: [r.id],
      examples: uniq([...exact, ...related.map((e) => e.path), ...inferred]),
      rows: rowsByTitle.get(slug(r.capability || '')) || [r.id],
    });
  }
  // Attribute each feature's parity rows in one pass. This keeps rows reachable without
  // repeatedly copying ever-growing arrays for every capability.
  for (const [feature, ids] of rowsByFeature) {
    for (const e of entriesByFeature.get(feature) || []) e.rows = uniq([...(e.rows || []), ...ids]);
    for (const e of entriesByName.get(feature) || []) e.rows = uniq([...(e.rows || []), ...ids]);
  }
  return out;
}

export function buildIndex(): Entry[] {
  const features = featureMap();
  const ex = examplesRaw();
  const base = [
    ...schemaEntries(features, ex),
    ...vocabEntries(),
    ...docsEntries(),
    ...commandEntries(),
  ];
  for (const e of ex)
    base.push({
      kind: 'example',
      name: e.path,
      summary: e.summary,
      aliases: uniq([...e.requires, ...e.names, path.basename(e.path)]),
      feature: e.requires[0]?.replaceAll('-', ''),
      examples: [e.path],
    });
  base.push(...capabilityEntries(base, ex));
  for (const [word, targets] of Object.entries(SYNONYMS))
    for (const e of base)
      if (targets.includes(e.name)) e.aliases = uniq([...(e.aliases || []), word]);
  const merged = new Map<string, Entry>();
  for (const e of base) {
    const key = `${e.kind}\0${e.name}`;
    const prior = merged.get(key);
    if (!prior) {
      merged.set(key, e);
      continue;
    }
    prior.aliases = uniq([...(prior.aliases || []), ...(e.aliases || [])]);
    prior.rows = uniq([...(prior.rows || []), ...(e.rows || [])]);
    prior.docs = uniq([...(prior.docs || []), ...(e.docs || [])]);
    prior.examples = uniq([...(prior.examples || []), ...(e.examples || [])]);
    prior.feature ||= e.feature;
    prior.schema ||= e.schema;
  }
  return [...merged.values()];
}
export function featureAfter(): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const [k, v] of featureMap()) m.set(k, v.after);
  return m;
}
export function exampleDetails() {
  return examplesRaw();
}
