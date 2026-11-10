// Contract between the command table (D-A) and the capability index (D-B); design/discovery/DESIGN.md
// D6–D7. D-B replaces the stub bodies; the types change only through the orchestrator.

export type EntryKind =
  | 'feature' // a `requires` name (module), e.g. rig, ik, input
  | 'type' // a node or object type, e.g. rect, ik, scroll-thumb
  | 'field' // a type's field, e.g. ik.bend (markup and .ani spellings)
  | 'element' // an AniML element, e.g. <copy-position>
  | 'address' // an animatable or bindable address pattern, e.g. <id>.rotate
  | 'ease' // a named ease or ease function, e.g. inOut, cubic(...)
  | 'function' // an expression function, e.g. contains(a, b)
  | 'event' // a listener event, e.g. enter, drag
  | 'script' // a `sample`/`session` script command, e.g. semantic
  | 'diagnostic' // a diagnostic code, e.g. undeclared-feature
  | 'doc' // a docs section (spec, authoring guide, module SPEC)
  | 'example' // an example scene file
  | 'capability' // a done parity row, e.g. rigging.ik
  | 'command'; // an `anima` CLI command

export interface Entry {
  kind: EntryKind;
  /** Canonical name, unique within its kind (`ik.bend`, `rigging.ik`, `examples/bell.animl`). */
  name: string;
  /** One line, plain text. */
  summary: string;
  /** Other spellings and concept words it answers to (AniML spelling, synonyms). */
  aliases?: string[];
  /** The `requires` feature that provides it, when there is one. */
  feature?: string;
  /** Parity row ids it implements or documents. */
  rows?: string[];
  /** Where to go next: `anima docs <topic>` topics. */
  docs?: string[];
  /** Example files (repo-relative) that use it. */
  examples?: string[];
  /** `anima schema <topic>` topic, when it has one. */
  schema?: string;
}

export interface SearchOptions {
  kinds?: EntryKind[];
  /** Default 10. */
  limit?: number;
}

export interface Hit {
  entry: Entry;
  /** Higher is better; only the order is meaningful. */
  score: number;
}

import { buildIndex, featureAfter, exampleDetails } from './build.ts';
import { suggest as suggestWords } from '../suggest.ts';
let CACHE: Entry[] | undefined;
const idx = () => (CACHE ??= buildIndex());

/** Every entry, built from the sources of truth (cached per process). */
export function index(): Entry[] {
  return idx();
}

const norm = (s: string) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[-_.<>/]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
const STOP = new Set([
  'a',
  'an',
  'the',
  'my',
  'it',
  'i',
  'on',
  'to',
  'of',
  'for',
  'with',
  'when',
  'is',
  'does',
  'and',
  'or',
]);
type SearchEntry = {
  entry: Entry;
  name: string;
  aliases: string[];
  summary: string;
  nameTokens: string[];
  aliasTokens: string[];
  summaryTokens: string[];
};
let SEARCH_DATA: { entries: SearchEntry[]; candidates: string[]; exact: Set<string> } | undefined;
function searchData() {
  if (SEARCH_DATA) return SEARCH_DATA;
  const entries = idx().map((entry) => {
    const name = norm(entry.name);
    const aliases = (entry.aliases || []).map(norm);
    const summary = norm(entry.summary);
    return {
      entry,
      name,
      aliases,
      summary,
      nameTokens: name.split(' '),
      aliasTokens: aliases.flatMap((alias) => alias.split(' ')),
      summaryTokens: summary.split(' '),
    };
  });
  const exact = new Set<string>();
  for (const item of entries)
    for (const token of [...item.nameTokens, ...item.aliasTokens]) exact.add(token);
  SEARCH_DATA = { entries, candidates: [...exact], exact };
  return SEARCH_DATA;
}

const CONTENT_KINDS = new Set<EntryKind>([
  'event',
  'ease',
  'function',
  'field',
  'element',
  'type',
  'feature',
  'command',
  'script',
  'diagnostic',
  'address',
]);
/** Ranked search over `index()`; empty when nothing is relevant (never pads with noise). */
export function search(query: string, options: SearchOptions = {}): Hit[] {
  const q = norm(query);
  if (!q) return [];
  const allTokens = q.split(' ');
  const qt = allTokens.filter((t) => !STOP.has(t));
  const tokens = qt.length ? qt : allTokens;
  const data = searchData();
  const entries = options.kinds
    ? data.entries.filter((item) => options.kinds!.includes(item.entry.kind))
    : data.entries;
  const exactTokens = options.kinds
    ? new Set(entries.flatMap((item) => [...item.nameTokens, ...item.aliasTokens]))
    : data.exact;
  const candidates = options.kinds ? [...exactTokens] : data.candidates;
  const fuzzy = new Map<string, Set<string>>();
  for (const token of tokens)
    if (token.length > 5 && !exactTokens.has(token))
      fuzzy.set(token, new Set(suggestWords(token, candidates)));
  const hits: Hit[] = [];
  for (const item of entries) {
    const e = item.entry,
      n = item.name,
      aliases = item.aliases,
      sum = item.summary,
      nameTokens = item.nameTokens,
      aliasTokens = item.aliasTokens,
      sumTokens = item.summaryTokens;
    let score = 0,
      matched = 0;
    if (n === q) {
      score = 140;
      matched = tokens.length;
    } else if (aliases.includes(q)) {
      score = 125;
      matched = tokens.length;
    } else if (sum === q || sum.startsWith(`${q} `)) {
      score = e.kind === 'capability' ? (sum === q ? 400 : 108) : 90;
      matched = tokens.length;
    } else
      for (const t of tokens) {
        let s = 0;
        if (nameTokens.includes(t)) s = e.kind === 'capability' ? 100 : 58;
        else if (aliasTokens.includes(t))
          s = e.kind === 'capability' ? 120 : e.kind === 'feature' ? 90 : 52;
        else if (n.includes(t)) s = 38;
        else if (aliases.some((a) => a.includes(t))) s = 34;
        else if (sumTokens.includes(t)) s = 17;
        else if (
          fuzzy.get(t)?.has(nameTokens.find((x) => fuzzy.get(t)?.has(x)) || '') ||
          aliasTokens.some((x) => fuzzy.get(t)?.has(x))
        )
          s = 22;
        if (s) {
          matched++;
          score += s;
        }
      }
    if (!matched) continue;
    const phraseAlias = aliases.some((alias) => alias.includes(' ') && q.includes(alias));
    if (phraseAlias) score += 100;
    if (
      (e.kind === 'type' || e.kind === 'element' || e.kind === 'feature') &&
      nameTokens.length === 1 &&
      tokens.includes(nameTokens[0]!)
    )
      score += 60;
    if (e.kind === 'capability') {
      const need = tokens.length >= 3 ? 2 : 1;
      if (matched < need) continue;
      score += matched * 5;
    } else if (CONTENT_KINDS.has(e.kind)) score += 45;
    else if (e.kind === 'doc') score += 6;
    if (score >= 22) hits.push({ entry: e, score });
  }
  return hits
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, options.limit ?? 10);
}

export interface FeatureInfo {
  entry: Entry;
  /** Everything the feature provides: types, fields, elements, addresses, events, eases, functions. */
  provides: Entry[];
  /** Features it needs loaded first (manifest `after`). */
  after: string[];
}

/** All features, or one by name (`undefined` when unknown). */
export function features(): FeatureInfo[];
export function features(name: string): FeatureInfo | undefined;
export function features(name?: string): FeatureInfo[] | FeatureInfo | undefined {
  const after = featureAfter();
  const entries = idx();
  const provided = new Map<string, Entry[]>();
  for (const e of entries)
    if (e.feature) provided.set(e.feature, [...(provided.get(e.feature) || []), e]);
  const all = entries
    .filter((e) => e.kind === 'feature')
    .map((entry) => ({
      entry,
      provides: (provided.get(entry.name) || []).filter((e) => e !== entry),
      after: after.get(entry.name) || [],
    }));
  return name === undefined
    ? all
    : all.find((x) => x.entry.name === name || x.entry.aliases?.includes(name));
}

export interface ExampleInfo {
  entry: Entry;
  /** Repo-relative path. */
  path: string;
  /** Its `requires` features. */
  requires: string[];
}

/** All examples, or those matching a feature, a file name or words (ranked). */
export function examples(filter?: string): ExampleInfo[] {
  const entries = idx();
  const byPath = new Map(
    entries.filter((e) => e.kind === 'example').map((e) => [e.name, e] as const),
  );
  const rows = exampleDetails().map((d) => ({
    entry: byPath.get(d.path)!,
    path: d.path,
    requires: d.requires,
  }));
  if (!filter) return rows;
  const q = norm(filter);
  return rows
    .map((x) => ({
      x,
      s: Math.max(
        x.requires.some((r) => norm(r) === q) ? 100 : 0,
        norm(x.path).includes(q) ? 70 : 0,
        norm(x.entry.summary).includes(q) ? 40 : 0,
      ),
    }))
    .filter((y) => y.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((y) => y.x);
}

/** Names close to `word` among `candidates` (D3 weighting), best first; empty below the cutoff. */
export type Suggest = (word: string, candidates: readonly string[]) => string[];
