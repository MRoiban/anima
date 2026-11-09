// Raw observations only. The orchestrator owns the completed oracle manifest and budgets.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { compile } from '../../packages/markup/src/index.ts';
import '../../packages/core/src/all.ts';
import { compare } from '../../tools/oracle.ts';
import { run } from '../../packages/cli/src/cli.ts';
const results = [];
for (const name of [
  'rigging-joystick',
  'animation-joystick-two-axis',
  'animation-joystick-invert',
  'animation-joystick-handle',
]) {
  const dir = new URL(`../../tests/oracle/${name}/`, import.meta.url);
  const compiled = compile(readFileSync(new URL('case.animl', dir), 'utf8'));
  if (!compiled.text || compiled.diagnostics.length)
    throw Error(JSON.stringify(compiled.diagnostics));
  writeFileSync(new URL('case.ani', dir), compiled.text);
  mkdirSync(new URL('anima/', dir), { recursive: true });
  const frames = [];
  for (const time of [0, 0.25, 0.5, 0.75, 1]) {
    const target = new URL(`anima/${time}.png`, dir);
    const code = await run(
      [
        'render',
        new URL('case.ani', dir).pathname,
        '--at',
        String(time),
        '--size',
        '240',
        '--background',
        '#ffffff',
        '-o',
        target.pathname,
      ],
      {
        out: () => {},
        err: (s) => {
          throw Error(s);
        },
        write: () => {},
      },
    );
    if (code) throw Error(`render failed: ${name}`);
    const { diff, ...measurement } = compare(
      readFileSync(target),
      readFileSync(new URL(`rive/frames/${time}.png`, dir)),
      16,
    );
    writeFileSync(new URL(`anima/${time}-diff.png`, dir), diff);
    frames.push({ time, ...measurement });
  }
  results.push({ name, frames });
}
writeFileSync(
  new URL('RAW-METRICS.json', import.meta.url),
  JSON.stringify(results, null, 2) + '\n',
);
console.log(JSON.stringify(results));
