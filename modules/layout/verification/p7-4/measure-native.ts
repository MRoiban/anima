// Report raw differences only. Oracle acceptance/budgets remain with the orchestrator.
import '../../../../packages/core/src/all.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { Resvg } from '@resvg/resvg-js';
import { load, Player, toSVG } from '../../../../packages/core/src/index.ts';
const p = new Player(
  load(JSON.parse(readFileSync('tests/oracle/layout-animated-reflow/case.ani', 'utf8'))).model!,
);
const actions = [
  () => p.step(0),
  () => {
    p.set('w', 18);
    p.step(0);
  },
  () => p.step(0.5),
  () => {
    p.set('w', 6);
    p.step(0.25);
  },
  () => p.step(0.5),
  () => p.step(0.5),
];
const report = [];
const primedReport = [];
for (let i = 0; i < actions.length; i++) {
  actions[i]!();
  const data = new Resvg(toSVG(p), { fitTo: { mode: 'width', value: 240 }, background: '#fff' })
    .render()
    .asPng();
  writeFileSync(`modules/layout/verification/p7-4/anima-${i}.png`, data);
  const actual = PNG.sync.read(data),
    reference = PNG.sync.read(
      readFileSync(`tests/oracle/layout-animated-reflow/rive/frames/${i}.png`),
    );
  let max = 0,
    over = 0;
  for (let k = 0; k < actual.data.length; k += 4) {
    let d = 0;
    for (let c = 0; c < 4; c++)
      d = Math.max(d, Math.abs(actual.data[k + c]! - reference.data[k + c]!));
    max = Math.max(max, d);
    if (d > 16) over++;
  }
  report.push({
    sample: i,
    time: p.time,
    target: p.layoutBox('root')!.width,
    drawn: p.drawnLayoutBox('root')!.width,
    maxDiff: max,
    pixelsOver16: over,
  });
  const primed = PNG.sync.read(
    readFileSync(`modules/layout/verification/p7-4/primed/frames/${i}.png`),
  );
  let primedMax = 0,
    primedOver = 0;
  for (let k = 0; k < actual.data.length; k += 4) {
    let d = 0;
    for (let c = 0; c < 4; c++)
      d = Math.max(d, Math.abs(actual.data[k + c]! - primed.data[k + c]!));
    primedMax = Math.max(primedMax, d);
    if (d > 16) primedOver++;
  }
  primedReport.push({
    sample: i,
    time: p.time,
    drawn: p.drawnLayoutBox('root')!.width,
    maxDiff: primedMax,
    pixelsOver16: primedOver,
  });
}
writeFileSync(
  'modules/layout/verification/p7-4/native-metrics.json',
  JSON.stringify(report, null, 2) + '\n',
);
writeFileSync(
  'modules/layout/verification/p7-4/primed-metrics.json',
  JSON.stringify(primedReport, null, 2) + '\n',
);
console.log(report, primedReport);
