/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '@anima-format/core/all';
import { NODE_TYPES, ELEMENTS, nodeShape, jsonSchema, markupName } from '@anima-format/core';
import type { Entry } from './api.ts';
import { SYNONYMS } from './synonyms.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
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

function files(dir: string, pred: (p: string) => boolean): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...files(rel, pred));
    else if (pred(rel)) out.push(rel.replaceAll('\\', '/'));
  }
  return out;
}
function headings(file: string) {
  if (!exists(file)) return [] as { title: string; level: number }[];
  return read(file)
    .split(/\r?\n/)
    .flatMap((l) => {
      const m = /^(#{2,3})\s+(.+)$/.exec(l);
      return m ? [{ title: m[2].replace(/\s+#+$/, '').trim(), level: m[1].length }] : [];
    });
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
      add(`${prefix}.${slug(h.title)}`, [prefix, slug(h.title)], h.title);
    }
  }
  for (const d of fs
    .readdirSync(path.join(ROOT, 'modules'), { withFileTypes: true })
    .filter((e) => e.isDirectory())) {
    const n = d.name;
    if (exists(`modules/${n}/SPEC.md`)) {
      add(n, [n], `${n} module specification`);
      for (const h of headings(`modules/${n}/SPEC.md`))
        add(`${n}.${slug(h.title)}`, [n, slug(h.title)], h.title);
    }
  }
  return out;
}
function examplesRaw() {
  const ps = uniq([
    ...files('examples', (p) => /\.(?:ani|animl)$/.test(p)),
    ...files('modules', (p) =>
      /(?:\/examples\/.*\.(?:ani|animl)$|\/capabilities\/[^/]+\/example\.animl$)/.test(p),
    ),
  ]);
  return ps.map((p) => {
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
    return {
      path: p,
      requires: uniq(requires),
      names: uniq(names),
      summary: summary || path.basename(p),
    };
  });
}
function featureMap() {
  const m = new Map<string, { after: string[]; summary: string; module: string }>();
  for (const f of files('modules', (p) => /\/manifest\.ts$/.test(p))) {
    const t = read(f);
    const mod = f.split('/')[1];
    const name = /\bname:\s*['"]([^'"]+)/.exec(t)?.[1] || mod;
    const canonical = name.replaceAll('-', '');
    const after = [...t.matchAll(/after:\s*\[([^\]]*)\]/gs)].flatMap((x) =>
      [...x[1].matchAll(/['"]([^'"]+)/g)].map((y) => y[1].replaceAll('-', '')),
    );
    const hs = headings(`modules/${mod}/SPEC.md`);
    const sum = hs[0]?.title || `${name} module`;
    m.set(canonical, { after: uniq(after), summary: sum, module: mod });
  }
  return m;
}
function schemaEntries(
  features: Map<string, { after: string[]; summary: string; module: string }>,
): Entry[] {
  const out: Entry[] = [];
  const ex = examplesRaw();
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
      docs: exists(`modules/${v.module}/SPEC.md`) ? [v.module] : undefined,
      examples: ex
        .filter((e) => e.requires.map((r) => r.replaceAll('-', '')).includes(f))
        .map((e) => e.path),
    });
  for (const n of NODE_TYPES) {
    let sh: any;
    try {
      sh = nodeShape(n as any);
    } catch {}
    const mk = (() => {
      try {
        return markupName(sh as any, n);
      } catch {
        return undefined;
      }
    })();
    const feat = featureFor(n);
    out.push({
      kind: 'type',
      name: n,
      summary: `${n} node type`,
      aliases: mk && mk !== n ? [mk] : undefined,
      feature: feat,
      schema: n,
      examples: ex
        .filter((e) => e.names.includes(n) || e.names.includes(mk || ''))
        .map((e) => e.path),
    });
    if (sh && typeof sh === 'object')
      for (const k of Object.keys(sh)) {
        const mn = k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
        out.push({
          kind: 'field',
          name: `${n}.${k}`,
          summary: `${k} field of ${n}`,
          aliases: mn !== k ? [`${n}.${mn}`, mn] : [k],
          feature: feat,
          schema: n,
        });
        out.push({
          kind: 'address',
          name: `<id>.${k}`,
          summary: `Bindable ${k} address on ${n}`,
          aliases: [`${n}.${k}`],
          feature: feat,
          schema: n,
        });
      }
  }
  for (const n of Object.keys(ELEMENTS as any)) {
    const feat = featureFor(n);
    out.push({
      kind: 'element',
      name: n,
      summary: `<${n}> AniML element`,
      aliases: [`<${n}>`],
      feature: feat,
      schema: n,
      examples: ex.filter((e) => e.names.includes(n)).map((e) => e.path),
    });
  }
  void jsonSchema;
  return out;
}
function vocabEntries(): Entry[] {
  const out: Entry[] = [];
  for (const n of ['linear', 'hold', 'in', 'out', 'inOut', 'cubic', 'elastic', 'steps'])
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
      out.push({ kind: 'script', name: m[1], summary: `sample/session script command ${m[1]}` });
  }
  if (exists('spec/SPEC.md'))
    for (const l of read('spec/SPEC.md').split(/\r?\n/)) {
      const m = /^\| `([^`]+)` \| (?:error|warning) \| (.+) \|$/.exec(l);
      if (m) out.push({ kind: 'diagnostic', name: m[1], summary: m[2] });
    }
  return out;
}
function commandEntries(): Entry[] {
  const t = read('packages/cli/src/cli.ts');
  const block = /const HELP = `([\s\S]*?)`;/m.exec(t)?.[1] || '';
  const by = new Map<string, string[]>();
  for (const line of block.split(/\r?\n/)) {
    const m = /^\s*anima\s+([a-z][\w-]*)(?:\s+[^ ]+)?[\s\S]*?(?:\s{2,}|$)(.*)$/.exec(line);
    if (!m) continue;
    const rest = line.replace(/^\s*anima\s+[a-z][\w-]*\s*/, '').replace(/\[[^\]]+\]|<[^>]+>/g, ' ');
    by.set(m[1], [...(by.get(m[1]) || []), rest.replace(/[-|]/g, ' ').replace(/\s+/g, ' ').trim()]);
  }
  return [...by].map(([name, parts]) => ({
    kind: 'command' as const,
    name,
    summary: uniq(parts).join('; ') || `anima ${name} command`,
    aliases: ['command'],
  }));
}

function capabilityEntries(base: Entry[]): Entry[] {
  const inv = JSON.parse(read('docs/parity/inventory.json'));
  const rows = Array.isArray(inv) ? inv : inv.rows || inv.capabilities || [];
  const ex = examplesRaw();
  const out: Entry[] = [];
  for (const r of rows) {
    if (r?.anima?.status !== 'done') continue;
    const feature = (r.anima.module || '').replaceAll('-', '');
    let docs: string[] | undefined;
    const c = String(r.anima.construct || '');
    const fm = /^(?:modules\/([^/]+)\/SPEC\.md|spec\/SPEC\.md)(?:;\s*(.+))?/.exec(c);
    if (fm) {
      const mod = fm[1];
      const heading = fm[2];
      docs = [
        mod
          ? heading
            ? `${mod} ${slug(heading)}`
            : mod
          : heading
            ? `spec ${slug(heading)}`
            : 'spec',
      ];
    }
    const exact = ex.filter(
      (e) =>
        e.path.includes(`/capabilities/${r.id}/`) ||
        e.path.includes(`/capabilities/${String(r.id).split('.').pop()}/`),
    );
    const related = ex.filter((e) =>
      e.requires.map((x) => x.replaceAll('-', '')).includes(feature),
    );
    out.push({
      kind: 'capability',
      name: r.id,
      summary: firstSentence(`${r.capability || ''}. ${r.what || ''}`),
      feature: feature || undefined,
      docs:
        docs ||
        (feature && base.some((e) => e.kind === 'doc' && e.name === feature)
          ? [feature]
          : ['spec']),
      examples: uniq([...exact, ...related].map((e) => e.path)),
      rows: [r.id],
    });
    for (const e of base)
      if (
        (feature && e.feature === feature) ||
        e.name === feature ||
        String(r.anima.construct || '')
          .toLowerCase()
          .includes(e.name.toLowerCase())
      )
        e.rows = uniq([...(e.rows || []), r.id]);
  }
  return out;
}
export function buildIndex(): Entry[] {
  const features = featureMap();
  const ex = examplesRaw();
  const base = [
    ...schemaEntries(features),
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
  base.push(...capabilityEntries(base));
  for (const [word, targets] of Object.entries(SYNONYMS))
    for (const e of base)
      if (targets.some((t) => e.name === t || e.name.startsWith(`${t}.`)))
        e.aliases = uniq([...(e.aliases || []), word]);
  const seen = new Set<string>();
  return base.filter((e) => {
    const k = `${e.kind}\0${e.name}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
export function featureAfter(): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const [k, v] of featureMap()) m.set(k, v.after);
  return m;
}
export function exampleDetails() {
  return examplesRaw();
}
