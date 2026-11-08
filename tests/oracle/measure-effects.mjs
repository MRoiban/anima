// Raw measurements only; this helper never assigns acceptance budgets.
import { URL } from 'node:url';
import console from 'node:console';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { run } from '../../packages/cli/src/cli.ts';
import { compare } from '../../tools/oracle.ts';
import { compile } from '../../packages/markup/src/index.ts';
const root = new URL('./', import.meta.url);
export const names = [
  'translation',
  'rotation',
  'scale',
  'opacity',
  'origin',
  'variation',
  'follow-path',
]
  .map((v) => 'text-modifier-' + v)
  .concat(
    ['units', 'falloff', 'easing', 'combine', 'run'].map((v) => 'text-range-' + v),
    'text-background',
    'text-background-fit',
  );
const results = [];
for (const name of names) {
  const dir = new URL(name + '/', root);
  const compiled = compile(readFileSync(new URL('case.animl', dir), 'utf8'));
  if (!compiled.text) throw Error(JSON.stringify(compiled.diagnostics));
  writeFileSync(new URL('case.ani', dir), compiled.text);
  mkdirSync(new URL('anima/', dir), { recursive: true });
  const file = new URL('anima/0.png', dir);
  const r = await run(
    [
      'render',
      new URL('case.ani', dir).pathname,
      '--size',
      '240',
      '--background',
      '#ffffff',
      '-o',
      file.pathname,
    ],
    { out: () => {}, err: console.error },
  );
  if (r !== 0) throw Error(JSON.stringify(r));
  const { diff, ...metrics } = compare(
    readFileSync(file),
    readFileSync(new URL('rive/frames/0.png', dir)),
    16,
  );
  writeFileSync(new URL('anima/0-diff.png', dir), diff);
  results.push({ name, ...metrics });
}
writeFileSync(new URL('effects-measurements.json', root), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
