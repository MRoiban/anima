// Compile time, tracked per phase next to the bundle sizes (docs/LOG.md). Report only: timings are
// machine-dependent, so the gate is the unchanged test limit plus a comparison in each phase's PR.
//   bell:     one compile (parse, check, build, load) of examples/bell.animl, median of 200
//   prefixes: every prefix of bell.animl compiled once (the robustness test's workload), median of 3
import { readFileSync } from 'node:fs';
import { compile } from '../packages/markup/src/index.ts';

const bell = readFileSync(new URL('../examples/bell.animl', import.meta.url), 'utf8');
const median = (xs: number[]) => xs.sort((a, b) => a - b)[xs.length >> 1]!;
const time = (f: () => void) => {
  const t = performance.now();
  f();
  return performance.now() - t;
};

for (let i = 0; i < 50; i++) compile(bell); // warm up
const one = median(Array.from({ length: 200 }, () => time(() => compile(bell))));
const sweep = median(
  Array.from({ length: 3 }, () =>
    time(() => {
      for (let i = 0; i <= bell.length; i++) compile(bell.slice(0, i));
    }),
  ),
);
console.log(
  `compile: bell ${one.toFixed(2)} ms; all ${bell.length + 1} prefixes ${Math.round(sweep)} ms`,
);
