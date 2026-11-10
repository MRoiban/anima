export type EntryKind =
  | 'feature'
  | 'type'
  | 'field'
  | 'element'
  | 'address'
  | 'ease'
  | 'function'
  | 'event'
  | 'script'
  | 'diagnostic'
  | 'doc'
  | 'example'
  | 'capability'
  | 'command';
export interface Entry {
  kind: EntryKind;
  name: string;
  summary: string;
  aliases?: string[];
  feature?: string;
  rows?: string[];
  docs?: string[];
  examples?: string[];
  schema?: string;
}
export interface SearchOptions {
  kinds?: EntryKind[];
  limit?: number;
}
export interface Hit {
  entry: Entry;
  score: number;
}
export interface FeatureInfo {
  entry: Entry;
  provides: Entry[];
  after: string[];
}
export interface ExampleInfo {
  entry: Entry;
  path: string;
  requires: string[];
}
export type Suggest = (word: string, candidates: readonly string[]) => string[];
import { buildIndex, featureAfter, exampleDetails } from './build.ts';
let CACHE: Entry[] | undefined;
const idx = () => (CACHE ??= buildIndex());
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
const lev = (a: string, b: string) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return d[a.length][b.length];
};
export function search(query: string, options: SearchOptions = {}): Hit[] {
  const q = norm(query);
  if (!q) return [];
  const qt = q.split(' ');
  const single = qt.length === 1;
  const hits: Hit[] = [];
  for (const e of idx()) {
    if (options.kinds && !options.kinds.includes(e.kind)) continue;
    const n = norm(e.name),
      aliases = (e.aliases || []).map(norm),
      sum = norm(e.summary);
    let score = 0;
    if (n === q) score = 120;
    else if (aliases.includes(q)) score = 105;
    else {
      let matched = 0;
      for (const t of qt) {
        let s = 0;
        if (n.split(' ').includes(t)) s = 55;
        else if (aliases.some((a) => a.split(' ').includes(t))) s = 48;
        else if (n.includes(t)) s = 35;
        else if (aliases.some((a) => a.includes(t))) s = 30;
        else if (sum.split(' ').includes(t)) s = 16;
        else if (single && t.length >= 4) {
          const names = [...n.split(' '), ...aliases.flatMap((a) => a.split(' '))];
          const best = Math.min(...names.map((x) => lev(t, x)));
          if (best <= Math.max(1, Math.floor(t.length / 4))) s = 22;
        }
        if (s) {
          matched++;
          score += s;
        }
      }
      if (!matched || score < 16) continue;
      if (e.kind === 'capability') {
        const st = norm(e.summary).split(' ');
        const covered = qt.filter((t) => st.includes(t)).length;
        score += 18 + covered * 12;
      }
    }
    if (score > 0) hits.push({ entry: e, score });
  }
  return hits
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, options.limit ?? 10);
}
export function features(): FeatureInfo[];
export function features(name: string): FeatureInfo | undefined;
export function features(name?: string): FeatureInfo[] | FeatureInfo | undefined {
  const after = featureAfter();
  const all = idx()
    .filter((e) => e.kind === 'feature')
    .map((entry) => ({
      entry,
      provides: idx().filter((e) => e !== entry && e.feature === entry.name),
      after: after.get(entry.name) || [],
    }));
  return name === undefined
    ? all
    : all.find((x) => x.entry.name === name || x.entry.aliases?.includes(name));
}
export function examples(filter?: string): ExampleInfo[] {
  const details = exampleDetails();
  const rows = details.map((d) => ({
    entry: idx().find((e) => e.kind === 'example' && e.name === d.path)!,
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
