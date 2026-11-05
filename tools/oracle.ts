import '@anima-format/core/all';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { compile } from '@anima-format/markup';
import { run } from '../packages/cli/src/cli.ts';

export interface OracleCase {
  name: string;
  times: number[];
  threshold: number;
  maxOverPercent: number;
  maxDiff: number;
}
export const root = new URL('../tests/oracle/', import.meta.url);
export const cases: OracleCase[] = JSON.parse(readFileSync(new URL('cases.json', root), 'utf8'));

/** Largest RGBA delta per pixel; no blur, alignment, edge exclusion or colour correction. */
export function compare(actual: Buffer, reference: Buffer, threshold: number) {
  const a = PNG.sync.read(actual);
  const b = PNG.sync.read(reference);
  if (a.width !== 240 || a.height !== 240 || b.width !== a.width || b.height !== a.height)
    throw new Error('oracle dimensions must be 240×240');
  let maxDiff = 0;
  let over = 0;
  const diff = new PNG({ width: a.width, height: a.height });
  for (let i = 0; i < a.data.length; i += 4) {
    let delta = 0;
    for (let c = 0; c < 4; c++) delta = Math.max(delta, Math.abs(a.data[i + c]! - b.data[i + c]!));
    maxDiff = Math.max(maxDiff, delta);
    if (delta > threshold) over++;
    diff.data.set([delta, delta, delta, 255], i);
  }
  return {
    maxDiff,
    over,
    overPercent: (100 * over) / (a.width * a.height),
    diff: PNG.sync.write(diff),
  };
}

export async function measure(c: OracleCase, output: URL) {
  const dir = new URL(`${c.name}/`, root);
  const compiled = compile(readFileSync(new URL('case.animl', dir), 'utf8'));
  if (compiled.diagnostics.length || !compiled.text)
    throw new Error(`${c.name}: ${JSON.stringify(compiled.diagnostics)}`);
  if (readFileSync(new URL('case.ani', dir), 'utf8') !== compiled.text)
    throw new Error(`${c.name}: stale case.ani (node tools/oracle.ts --build)`);
  mkdirSync(output, { recursive: true });
  const metrics = [];
  for (const time of c.times) {
    const target = new URL(`${time}.png`, output);
    const messages: string[] = [];
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
        out: (s) => messages.push(s),
        err: (s) => messages.push(s),
        write: (s) => messages.push(s),
      },
    );
    if (code) throw new Error(`${c.name}: anima render: ${messages.join('\n')}`);
    const { diff, ...m } = compare(
      readFileSync(target),
      readFileSync(new URL(`rive/frames/${time}.png`, dir)),
      c.threshold,
    );
    writeFileSync(new URL(`${time}-diff.png`, output), diff);
    metrics.push({ time, ...m, pass: m.overPercent <= c.maxOverPercent && m.maxDiff <= c.maxDiff });
  }
  return metrics;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (process.argv.includes('--build')) {
    for (const c of cases) {
      const dir = new URL(`${c.name}/`, root);
      const r = compile(readFileSync(new URL('case.animl', dir), 'utf8'));
      if (r.diagnostics.length || !r.text) throw new Error(JSON.stringify(r.diagnostics));
      writeFileSync(new URL('case.ani', dir), r.text);
    }
  }
  const results = [];
  for (const c of cases) {
    const frames = await measure(c, new URL(`${c.name}/anima/`, root));
    results.push({
      name: c.name,
      threshold: c.threshold,
      maxOverPercent: c.maxOverPercent,
      frames,
    });
    console.log(c.name, JSON.stringify(frames));
  }
  writeFileSync(new URL('metrics.json', root), JSON.stringify(results, null, 2) + '\n');
  if (process.argv.includes('--strict') && results.some((r) => r.frames.some((f) => !f.pass)))
    process.exitCode = 1;
}
