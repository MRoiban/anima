import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { URL } from 'node:url';
import console from 'node:console';
import { compare } from '../../tools/oracle.ts';
import { run } from '../../packages/cli/src/cli.ts';
const io = { out: (s) => console.log(s), err: (s) => console.error(s) };
const execute = (args) => run(args, io);
const read = (path) => readFileSync(new URL(path, import.meta.url));
const controls = [
  ['p7-text-fit-controls/rive/frames/9.png', 'text-overflow-fit-font-size/rive/frames/0.png'],
  ['p7-text-fit-controls/rive/frames/9.png', 'text-fit-layout-measure/rive/frames/0.png'],
  [
    'p7-text-geometry-controls/rive/frames/baseline-false.png',
    'text-fit-baseline/rive/frames/0.png',
  ],
  ['p7-text-geometry-controls/rive/frames/trim-none.png', 'text-vertical-trim/rive/frames/0.png'],
  [
    'p7-text-geometry-controls/rive/frames/trim-explicit.png',
    'text-vertical-trim/rive/frames/0.png',
  ],
  [
    'p7-text-geometry-controls/rive/frames/ellipsis-dots.png',
    'text-overflow-ellipsis/rive/frames/0.png',
  ],
];
const numbers = ({ maxDiff, over, overPercent }) => ({ maxDiff, over, overPercent });
const output = {
  method:
    'Raw 240×240 RGBA largest-channel delta, threshold >16; no image transforms or tolerance assignment.',
  nativeControls: controls.map(([control, reference]) => ({
    control,
    reference,
    ...numbers(compare(read(control), read(reference), 16)),
  })),
  anima: [],
};
const destination = resolve('modules/text/verification/p7-6/geometry');
mkdirSync(destination, { recursive: true });
for (const name of [
  'text-fit-baseline',
  'text-fit-layout-measure',
  'text-overflow-fit-font-size',
  'text-overflow-ellipsis',
  'text-vertical-trim',
  'text-flatten',
]) {
  const actual = resolve(destination, name + '.png');
  if (name === 'text-flatten') {
    const status = await execute([
      'build',
      `tests/oracle/${name}/case.animl`,
      '-o',
      `tests/oracle/${name}/case.ani`,
    ]);
    if (status) throw Error(name + ': build exit ' + status);
  }
  const status = await execute([
    'render',
    `tests/oracle/${name}/case.ani`,
    '--size',
    '240',
    '--background',
    '#ffffff',
    '-o',
    actual,
  ]);
  if (status) throw Error(name + ': render exit ' + status);
  output.anima.push({
    name,
    ...numbers(compare(readFileSync(actual), read(`${name}/rive/frames/0.png`), 16)),
  });
}
writeFileSync(
  new URL('p7-text-measurements.json', import.meta.url),
  JSON.stringify(output, null, 2) + '\n',
);
console.log(JSON.stringify(output));
