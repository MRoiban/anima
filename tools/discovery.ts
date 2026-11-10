// Discovery metric (design/discovery/DESIGN.md "Target and measurement"). Orchestrator-owned:
// agents run it and climb it, never change it or its quiz.
//   node tools/discovery.ts            quiz, rows reachable, rows with docs and examples
//   node tools/discovery.ts --json     the same as JSON
//   node tools/discovery.ts --baseline the quiz against today's `schema --search` (proxy)
//   node tools/discovery.ts --misses   also list every miss
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { run, type IO } from '../packages/cli/src/cli.ts';

interface Quiz {
  limit: number;
  queries: { q: string; expect: string[] }[];
}
interface Row {
  id: string;
  capability: string;
  anima: { status?: string };
}

const root = resolve(import.meta.dirname, '..');
const quiz = JSON.parse(readFileSync(resolve(root, 'tools/discovery-quiz.json'), 'utf8')) as Quiz;
const rows = (
  JSON.parse(readFileSync(resolve(root, 'docs/parity/inventory.json'), 'utf8')) as Row[]
).filter((r) => r.anima.status === 'done');
const argv = process.argv.slice(2);

async function cli(args: string[]): Promise<{ code: number; out: string }> {
  let out = '';
  const io: IO = { out: (s) => (out += s + '\n'), err: () => {}, write: (s) => (out += s) };
  const code = await run(args, io);
  return { code, out };
}

const pct = (n: number, d: number) => `${n}/${d} (${d ? ((100 * n) / d).toFixed(1) : '0.0'} %)`;

if (argv.includes('--baseline')) {
  let pass = 0;
  const misses: string[] = [];
  for (const { q, expect } of quiz.queries) {
    const { out } = await cli(['schema', '--search', q]);
    const names = out
      .split('\n')
      .filter(Boolean)
      .slice(0, quiz.limit)
      .map((l) => l.split('\t')[0]!);
    if (names.some((n) => expect.includes(n))) pass++;
    else misses.push(q);
  }
  console.log(`baseline (schema --search proxy) quiz: ${pct(pass, quiz.queries.length)}`);
  if (argv.includes('--misses')) for (const m of misses) console.log('  miss: ' + m);
  process.exit(0);
}

const api = await import('../packages/cli/src/discover/api.ts');
const matches = (e: { name: string; feature?: string; rows?: string[] }, expect: string[]) =>
  expect.includes(e.name) ||
  (e.feature !== undefined && expect.includes(e.feature)) ||
  (e.rows ?? []).some((r) => expect.includes(r));

const quizMiss: string[] = [];
for (const { q, expect } of quiz.queries) {
  const hits = api.search(q, { limit: quiz.limit });
  if (!hits.slice(0, quiz.limit).some((h) => matches(h.entry, expect))) quizMiss.push(q);
}

const rowMiss: string[] = [];
for (const r of rows) {
  const hits = api.search(r.capability, { limit: quiz.limit });
  if (!hits.slice(0, quiz.limit).some((h) => (h.entry.rows ?? []).includes(r.id)))
    rowMiss.push(r.id);
}

const byRow = new Map<string, { docs: string[]; examples: string[] }>();
for (const e of api.index())
  for (const id of e.rows ?? []) {
    const slot = byRow.get(id) ?? { docs: [], examples: [] };
    slot.docs.push(...(e.docs ?? []));
    slot.examples.push(...(e.examples ?? []));
    byRow.set(id, slot);
  }
const topicOk = new Map<string, boolean>();
const docsMiss: string[] = [],
  exampleMiss: string[] = [];
for (const r of rows) {
  const slot = byRow.get(r.id);
  let docsOk = false;
  for (const topic of new Set(slot?.docs ?? [])) {
    if (!topicOk.has(topic))
      topicOk.set(topic, (await cli(['docs', ...topic.split(/\s+/)])).code === 0);
    if (topicOk.get(topic)) docsOk = true;
  }
  if (!docsOk) docsMiss.push(r.id);
  if (!(slot?.examples ?? []).some((p) => existsSync(resolve(root, p)))) exampleMiss.push(r.id);
}

const result = {
  quiz: {
    pass: quiz.queries.length - quizMiss.length,
    total: quiz.queries.length,
    misses: quizMiss,
  },
  rowsReachable: { pass: rows.length - rowMiss.length, total: rows.length, misses: rowMiss },
  rowsWithDocs: { pass: rows.length - docsMiss.length, total: rows.length, misses: docsMiss },
  rowsWithExample: {
    pass: rows.length - exampleMiss.length,
    total: rows.length,
    misses: exampleMiss,
  },
};
if (argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
else {
  for (const [k, v] of Object.entries(result)) {
    console.log(`${k.padEnd(16)} ${pct(v.pass, v.total)}`);
    if (argv.includes('--misses')) for (const m of v.misses) console.log('  miss: ' + m);
  }
}
