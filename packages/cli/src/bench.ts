import { drawFrame, type Model } from '@anima-format/core';
import { runScript, type ScriptOptions } from '../../core/src/script.ts';

const percentile = (xs: number[], p: number) =>
  xs.sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))]!;

/** Same renderer-neutral step/draw path as tools/perf.ts; costs exclude I/O and script setup. */
export function bench(
  load: () => Model | undefined,
  script: string,
  frames: number,
  opts: ScriptOptions = {},
) {
  const start = performance.now();
  const model = load();
  const compileMs = performance.now() - start;
  if (!model) return undefined;
  const run = runScript(model, script, opts);
  if (run.diagnostics.length || run.stopped) return { diagnostics: run.diagnostics };
  const player = run.player;
  // Warm renderer caches on a separate player so measured frame 1 still follows the script.
  const warm = runScript(model, script, opts).player;
  for (let i = 0; i < 50; i++) {
    warm.step(1 / 60);
    drawFrame(warm);
  }
  const step: number[] = [],
    draw: number[] = [];
  for (let i = 0; i < frames; i++) {
    const t0 = performance.now();
    player.step(1 / 60);
    const t1 = performance.now();
    drawFrame(player);
    const t2 = performance.now();
    step.push((t1 - t0) * 1000);
    draw.push((t2 - t1) * 1000);
  }
  return {
    frames,
    compileMs,
    unit: 'µs',
    step: { median: percentile(step, 0.5), p95: percentile(step, 0.95) },
    draw: { median: percentile(draw, 0.5), p95: percentile(draw, 0.95) },
  };
}
