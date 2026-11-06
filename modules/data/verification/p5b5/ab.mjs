// Independent paired verification; the repository's tools/perf.ts and inputs stay unchanged.
// Usage: taskset -c 11 node modules/data/verification/p5b5/ab.mjs <baseline archive root>
import { readFileSync } from 'node:fs';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
const branch = fileURLToPath(new URL('../../../../', import.meta.url));
const roots = [resolve(process.argv[2]), branch];
const suites = [];
for (const root of roots) {
  const url = (p) => pathToFileURL(resolve(root, p)).href;
  await import(url('packages/core/src/all.ts'));
  const { load, Player, drawFrame } = await import(url('packages/core/src/index.ts'));
  const { compile } = await import(url('packages/markup/src/index.ts'));
  const bell = readFileSync(resolve(root, 'tools/perf/bell.animl'), 'utf8');
  const frame = (name) => {
    const model = load(readFileSync(resolve(root, `examples/${name}.ani`), 'utf8')).model;
    return () => {
      const p = new Player(model),
        start = performance.now();
      for (let i = 0; i < 6000; i++) {
        if (name === 'bell') {
          if (i === 0) p.set('hover', true);
          if (i % 90 === 0) p.fire('ring');
        } else if (name === 'toolbar' && i % 60 === 0) p.set('unread', (i / 60) % 10);
        p.step(1 / 60);
        drawFrame(p);
      }
      return (performance.now() - start) / 6;
    };
  };
  suites.push({
    bell: frame('bell'),
    composite: frame('composite'),
    toolbar: frame('toolbar'),
    compile: () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) compile(bell);
      return (performance.now() - start) / 100;
    },
  });
}
const median = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
for (const key of ['bell', 'composite', 'toolbar', 'compile']) {
  for (let i = 0; i < 4; i++) for (const s of suites) s[key]();
  const values = [[], []];
  for (let i = 0; i < 12; i++)
    for (const index of i % 2 ? [1, 0] : [0, 1]) values[index].push(suites[index][key]());
  console.log(
    JSON.stringify({
      key,
      unit: key === 'compile' ? 'ms' : 'us',
      baseline: median(values[0]),
      branch: median(values[1]),
      raw: values,
    }),
  );
}
