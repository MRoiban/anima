import { spawnSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { matches } from './filter.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const history = ['advance 0', 'focus target search'];
const captures = [];
let run = 0;
// sample installs a font measurer; session currently does not. Replay the complete
// deterministic history for each read/write round trip, without private APIs.
function sample(extra, name) {
  const script = [...history, ...extra].join('; ');
  const args = ['sample', `${here}search.animl`, '--font', 'sans-serif=fixtures/fonts/anima-test.ttf', '-e', script];
  const result = spawnSync('node', ['packages/cli/src/main.ts', ...args], { encoding: 'utf8' });
  run++;
  writeFileSync(`${here}evidence/proof-${run}-${name}.txt`, result.stdout + result.stderr);
  appendFileSync(`${here}evidence/commands.jsonl`, JSON.stringify({ utc: new Date().toISOString(), args, exit: result.status }) + '\n');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout.trim().split('\n').map((line) => JSON.parse(line));
}
function checkpoint(name, expectedIds) {
  const dump = sample(['data dump'], `${name}-read`).find((value) => value.data)?.data;
  const flags = matches(dump.$query, Array.from({ length: 5 }, (_, i) => dump[`$label${i}`]));
  history.push(...flags.map((value, i) => `data set $shown${i} ${value}`), 'advance 0');
  const output = sample(['data dump', 'semantics', 'snapshot --all --semantics'], name);
  const data = output.find((value) => value.data)?.data;
  const tree = output.find(Array.isArray);
  const rows = tree.filter((node) => /^row\d$/.test(node.id));
  assert.deepEqual(rows.map((row) => row.id), expectedIds);
  assert.equal(data.$count, expectedIds.length);
  assert.equal(data.$countText, `${expectedIds.length} results`);
  assert.equal(tree.find((node) => node.id === 'search').value, data.$query);
  rows.forEach((row) => assert.equal(row.label, data[`$label${row.id.slice(3)}`]));
  captures.push({ name, data, tree });
}
checkpoint('empty', ['row0', 'row1', 'row2', 'row3', 'row4']);
history.push('type "o"', 'advance 0');
checkpoint('o', ['row0', 'row1', 'row2', 'row3']);
history.push('select 0 1', 'type "so"', 'advance 0');
checkpoint('so', ['row2']);
history.push('select 0 2', 'type ""', 'advance 0');
checkpoint('cleared', ['row0', 'row1', 'row2', 'row3', 'row4']);
history.push('data set $label4 "Other options"', 'advance 0');
checkpoint('renamed', ['row0', 'row1', 'row2', 'row3', 'row4']);
history.push('type "OTHER"', 'advance 0');
checkpoint('renamed-uppercase-query', ['row4']);
writeFileSync(`${here}evidence/captures.json`, JSON.stringify(captures, null, 2) + '\n');
writeFileSync(`${here}interaction.txt`, [...history, 'data dump', 'semantics'].join('\n') + '\n');
console.log(`${captures.length} checkpoints passed; ${run} sample runs. Filtering used filter.mjs between CLI reads and writes.`);
