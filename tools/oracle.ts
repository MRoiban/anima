import '@anima-format/core/all';
import { pendingReason } from './pending.ts';
import { globSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { PNG } from 'pngjs';
import { compile } from '@anima-format/markup';
import { run } from '../packages/cli/src/cli.ts';
import { load, runScript } from '@anima-format/core';

export interface OracleCase {
  name: string;
  times: number[];
  threshold: number;
  maxOverPercent: number;
  maxDiff: number;
  scripts?: Record<string, string>;
  events?: {
    fps: number;
    script: string;
    reference: string;
    omitLifecycle?: boolean;
    urls?: boolean;
    payloadPaths?: Record<string, Record<string, string>>;
  };
  values?: { address: string; path: string; tolerance: number };
  /** Post-click observations, indexed by interaction rather than animation frame. */
  observations?: { script: string; reference: string };
}
export const root = new URL('../tests/oracle/', import.meta.url);
export const cases: OracleCase[] = JSON.parse(readFileSync(new URL('cases.json', root), 'utf8'));

export const pendingCases = globSync('*/todo.json', { cwd: root }).map((path) => ({
  name: path.split('/')[0]!,
  reason: pendingReason(new URL('./', new URL(path, root)))!,
}));
export const skippedCases: {
  name: string;
  status: string;
  reason: string;
  tests: string[];
  captureEvidence?: string[];
}[] = globSync('*/skip.json', { cwd: root }).map((path) => ({
  name: path.split('/')[0]!,
  ...JSON.parse(readFileSync(new URL(path, root), 'utf8')),
}));
export const findingCases: { reason: string; case: OracleCase }[] = globSync('**/finding.json', {
  cwd: root,
}).map((path) => JSON.parse(readFileSync(new URL(path, root), 'utf8')));
for (const c of cases)
  if (pendingReason(new URL(`${c.name}/`, root)))
    throw Error(`${c.name}: pending oracle must not be in cases.json`);

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

/** Compare ordered reports exactly, including frame and every observed payload field. */
export function compareEvents(actual: unknown, reference: unknown) {
  const pass = isDeepStrictEqual(actual, reference);
  return {
    actual,
    reference,
    maxDiff: pass ? 0 : 1,
    over: pass ? 0 : 1,
    overPercent: pass ? 0 : 100,
    pass,
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
  if (c.observations) {
    const config = c.observations;
    const model = load(compiled.doc!).model!;
    const { snapshots } = runScript(model, readFileSync(new URL(config.script, dir), 'utf8'));
    const actual = snapshots.map((snapshot, click) => ({
      click,
      values: snapshot.values,
      events: snapshot.events
        .filter(
          (event) => !['@state-end', '@transition-start', '@transition-end'].includes(event.name),
        )
        .map((event) => ({
          name: event.name,
          ...(event.payload === undefined ? {} : { payload: event.payload }),
        })),
    }));
    const reference = JSON.parse(readFileSync(new URL(config.reference, dir), 'utf8'));
    return [{ time: c.times.at(-1)!, ...compareEvents(actual, reference) }];
  }
  if (c.events) {
    const config = c.events;
    const model = load(compiled.doc!).model!;
    const { snapshots } = runScript(model, readFileSync(new URL(config.script, dir), 'utf8'));
    const actual = snapshots.flatMap((snapshot, frame) => {
      if (Math.round(snapshot.time * config.fps) !== frame)
        throw Error(`${c.name}: event script must snapshot every frame including zero`);
      return snapshot.events
        .filter(
          (event) =>
            !config.omitLifecycle ||
            !['@state-end', '@transition-start', '@transition-end'].includes(event.name),
        )
        .map((event) => ({
          frame,
          ...(config.urls && event.url ? { url: event.url } : { name: event.name }),
          ...(event.payload === undefined ? {} : { payload: event.payload }),
        }));
    });
    const reference = JSON.parse(readFileSync(new URL(config.reference, dir), 'utf8'));
    return [{ time: c.times.at(-1)!, ...compareEvents(actual, reference) }];
  }
  const metrics = [];
  for (const time of c.times) {
    if (c.values) {
      const reference = JSON.parse(readFileSync(new URL(`rive/frames/${time}.json`, dir), 'utf8'));
      const property = reference.viewModel.properties.find(
        (p: { path: string }) => p.path === c.values!.path,
      );
      if (!property) throw Error(`${c.name}: missing data path ${c.values.path}`);
      const model = load(compiled.doc!).model!;
      const { player } = runScript(model, c.scripts?.[String(time)] ?? `advance ${time}`);
      player.step(0);
      const actual = player.value(c.values.address);
      const delta =
        typeof actual === 'number' && typeof property.value === 'number'
          ? Math.abs(actual - property.value)
          : actual === property.value
            ? 0
            : Infinity;
      metrics.push({
        time,
        actual,
        reference: property.value,
        maxDiff: delta,
        over: delta > c.values.tolerance ? 1 : 0,
        overPercent: delta > c.values.tolerance ? 100 : 0,
        pass: delta <= c.values.tolerance,
      });
      continue;
    }
    const target = new URL(`${time}.png`, output);
    const messages: string[] = [];
    const code = await run(
      [
        'render',
        new URL('case.ani', dir).pathname,
        ...(c.scripts?.[String(time)] ? ['-e', c.scripts[String(time)]!] : []),
        '--at',
        c.scripts?.[String(time)] ? '0' : String(time),
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
  for (const finding of findingCases)
    console.log(`FINDING ${finding.case.name}: ${finding.reason}`);
  for (const c of pendingCases) console.log(`Pending oracle ${c.name}: ${c.reason}`);
  for (const c of skippedCases) console.log(`Skipped oracle ${c.name}: ${c.reason}`);
  if (process.argv.includes('--build')) {
    for (const c of [...cases, ...findingCases.map((f) => f.case)]) {
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
  const findings = [];
  for (const finding of findingCases) {
    const frames = await measure(finding.case, new URL(`${finding.case.name}/anima/`, root));
    findings.push({ name: finding.case.name, reason: finding.reason, frames });
    console.log(`FINDING comparison ${finding.case.name}`, JSON.stringify(frames));
  }
  writeFileSync(new URL('findings-metrics.json', root), JSON.stringify(findings, null, 2) + '\n');
  writeFileSync(new URL('metrics.json', root), JSON.stringify(results, null, 2) + '\n');
  if (process.argv.includes('--strict') && results.some((r) => r.frames.some((f) => !f.pass)))
    process.exitCode = 1;
}
