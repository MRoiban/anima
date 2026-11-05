// Compile time and per-frame cost, tracked per phase next to the bundle sizes (docs/LOG.md). Report only: timings are
// machine-dependent, so the gate is the unchanged test limit plus a comparison in each phase's PR.
//   bell:     one compile (parse, check, build, load) of examples/bell.animl, median of 200
//   prefixes: every prefix of bell.animl compiled once (the robustness test's workload), median of 3
import { readFileSync } from 'node:fs';
import { compile } from '../packages/markup/src/index.ts';
import { drawFrame, load, Player } from '../packages/core/src/index.ts';
import '../packages/core/src/all.ts';

// A fixed, self-contained workload (examples/bell.animl at P4a), so the number only moves when
// the compiler does, not when the examples are rewritten.
const bell = readFileSync(new URL('./perf/bell.animl', import.meta.url), 'utf8');
const options = {
  file: 'examples/bell.animl',
  resolve: (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8'),
};
const median = (xs: number[]) => xs.sort((a, b) => a - b)[xs.length >> 1]!;
const time = (f: () => void) => {
  const t = performance.now();
  f();
  return performance.now() - t;
};

for (let i = 0; i < 50; i++) compile(bell, options); // warm up
const one = median(Array.from({ length: 200 }, () => time(() => compile(bell, options))));
const sweep = median(
  Array.from({ length: 3 }, () =>
    time(() => {
      for (let i = 0; i <= bell.length; i++) compile(bell.slice(0, i), options);
    }),
  ),
);
console.log(
  `compile: bell ${one.toFixed(2)} ms; all ${bell.length + 1} prefixes ${Math.round(sweep)} ms`,
);

// Per-frame cost (owner, 2026-11-06: tracked next to bytes): one 60 fps frame of the renderer-neutral
// path — Player.step plus drawFrame — for the bell while hovered and ringing, and for the composite
// example; mean over 6 000 frames, median of 5 runs. The DOM write of the web backend is not
// included (it needs a browser).

const frameCost = (file: string, drive: (p: Player, i: number) => void) => {
  const model = load(readFileSync(new URL('../' + file, import.meta.url), 'utf8')).model!;
  const run = () => {
    const p = new Player(model);
    return time(() => {
      for (let i = 0; i < 6000; i++) {
        drive(p, i);
        p.step(1 / 60);
        drawFrame(p);
      }
    });
  };
  run();
  return (median(Array.from({ length: 5 }, run)) / 6000) * 1000;
};
const bellFrame = frameCost('examples/bell.ani', (p, i) => {
  if (i === 0) p.set('hover', true);
  if (i % 90 === 0) p.fire('ring');
});
const compositeFrame = frameCost('examples/composite.ani', () => {});
console.log(`frame: bell ${bellFrame.toFixed(1)} µs; composite ${compositeFrame.toFixed(1)} µs`);
