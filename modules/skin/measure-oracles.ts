// Raw P8-4 oracle measurements only. Fixed budgets remain owned by the orchestrator.
import { globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { compile, formatMarkup } from '../../packages/markup/src/index.ts';
import { run } from '../../packages/cli/src/cli.ts';

const results = [];
const ink = (png: PNG, x: number, y: number) => {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return false;
  const i = (y * png.width + x) * 4;
  return png.data[i]! < 250 || png.data[i + 1]! < 250 || png.data[i + 2]! < 250;
};
const interior = (png: PNG, x: number, y: number) => {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) if (!ink(png, x + dx, y + dy)) return false;
  return true;
};

for (const file of globSync(
  'tests/oracle/rigging-{skin,weights,cubic-weights}/case.animl',
).sort()) {
  const dir = file.slice(0, -11);
  const source = formatMarkup(readFileSync(file, 'utf8')).text!;
  const built = compile(source);
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
        err: (message) => {
          throw Error(message);
        },
      },
    );
    if (code) throw Error('render failed ' + file);
    const a = PNG.sync.read(readFileSync(target));
    const b = PNG.sync.read(readFileSync(dir + '/rive/frames/' + time + '.png'));
    let max = 0,
      over = 0,
      edge = 0,
      inside = 0,
      outside = 0;
    for (let y = 0; y < a.height; y++)
      for (let x = 0; x < a.width; x++) {
        const i = (y * a.width + x) * 4;
        let d = 0;
        for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(a.data[i + k]! - b.data[i + k]!));
        max = Math.max(max, d);
        if (d <= 16) continue;
        over++;
        if (interior(a, x, y) && interior(b, x, y)) inside++;
        else if (!ink(a, x, y) && !ink(b, x, y)) outside++;
        else edge++;
      }
    const row = {
      name: dir.split('/').at(-1),
      time,
      max,
      over,
      edge,
      interior: inside,
      exterior: outside,
    };
    results.push(row);
    console.log(JSON.stringify(row));
  }
}
writeFileSync('modules/skin/oracle-raw.json', JSON.stringify(results, null, 2) + '\n');
