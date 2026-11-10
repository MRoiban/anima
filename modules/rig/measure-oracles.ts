// Raw measurements only. Fixed acceptance budgets are owned by the orchestrator.
import { globSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import { compile, formatMarkup } from '../../packages/markup/src/index.ts';
import { run } from '../../packages/cli/src/cli.ts';
const results = [];
for (const file of globSync('tests/oracle/rigging-*/case.animl')
  .filter((file) => !/rigging-(mesh|joystick)/.test(file))
  .sort()) {
  const dir = file.slice(0, -11),
    source = formatMarkup(readFileSync(file, 'utf8')).text!,
    built = compile(source);
  if (!built.text) throw Error(file + JSON.stringify(built.diagnostics));
  writeFileSync(file, source);
  writeFileSync(dir + '/case.ani', built.text);
  mkdirSync(dir + '/anima', { recursive: true });
  for (const time of [0, 0.5, 1]) {
    const target = dir + '/anima/' + time + '.png';
    const code = await run(
      [
        'render',
        dir + '/case.ani',
        '--at',
        String(time),
        '--size',
        '240',
        '--background',
        '#ffffff',
        '-o',
        target,
      ],
      {
        out: () => {},
        err: (s) => {
          throw Error(s);
        },
      },
    );
    if (code) throw Error('render failed ' + file);
    const a = PNG.sync.read(readFileSync(target)),
      b = PNG.sync.read(readFileSync(dir + '/rive/frames/' + time + '.png'));
    if (a.width !== b.width || a.height !== b.height) throw Error('different frame dimensions');
    let max = 0,
      over = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      let d = 0;
      for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(a.data[i + k]! - b.data[i + k]!));
      max = Math.max(max, d);
      if (d > 16) over++;
    }
    const row = {
      name: dir.split('/').at(-1),
      time,
      max,
      over,
      pixels: a.width * a.height,
      percent: (100 * over) / (a.width * a.height),
    };
    results.push(row);
    console.log(JSON.stringify(row));
  }
}
writeFileSync('modules/rig/oracle-raw.json', JSON.stringify(results, null, 2) + '\n');
