import '@anima-format/core/all';
// Runs spec/conformance/*/ (spec §11) and the ease golden vectors.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { load, parseEase, runScript } from '../src/index.ts';

const DIR = new URL('../../../spec/conformance/', import.meta.url);
const cases = readdirSync(DIR).filter((f) => statSync(new URL(f, DIR)).isDirectory());

/** Deep equality with numbers compared at 1e-6. Returns a path to the first difference. */
export function diff(a: unknown, b: unknown, path = ''): string | null {
  if (typeof a === 'number' && typeof b === 'number')
    return Math.abs(a - b) <= 1e-6 ? null : `${path}: ${a} ≠ ${b}`;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: length ${a.length} ≠ ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = diff(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (ka.join() !== kb.join()) return `${path}: keys ${ka} ≠ ${kb}`;
    for (const k of ka) {
      const d = diff(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        `${path}.${k}`,
      );
      if (d) return d;
    }
    return null;
  }
  return a === b ? null : `${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
}

describe('conformance', () => {
  it.each(cases)('%s', (c) => {
    const read = (f: string) => readFileSync(new URL(`${c}/${f}`, DIR), 'utf8');
    const { model, diagnostics } = load(read('case.ani'));
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const got = runScript(model!, read('script.txt')).snapshots;
    const want = read('expected.jsonl')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(got.length).toBe(want.length);
    want.forEach((w, i) => expect(diff(got[i], w), `snapshot ${i + 1}`).toBeNull());
  });

  it('eases match the golden vectors to 1e-7', () => {
    const golden = JSON.parse(readFileSync(new URL('eases.json', DIR), 'utf8'));
    for (const { ease, u, w } of golden.cases as { ease: string; u: number[]; w: number[] }[]) {
      const f = parseEase(ease);
      expect(typeof f, ease).toBe('function');
      u.forEach((x, i) =>
        expect(Math.abs((f as (u: number) => number)(x) - w[i]!), `${ease} at ${x}`).toBeLessThan(
          1e-7,
        ),
      );
    }
  });
});
