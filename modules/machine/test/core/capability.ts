import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { jsonSchema, load, runScript } from '@anima-format/core';
import { compile, decompile } from '@anima-format/markup';
export function capability(name: string): void {
  const root = new URL('../../../../', import.meta.url);
  const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
  it(name + ': both syntaxes, CLI sampling and declared-use diagnostic', () => {
    const base = 'spec/conformance/' + name + '/';
    const c = compile(read(base + 'case.animl'));
    expect(c.diagnostics).toEqual([]);
    expect(compile(decompile(c.doc!)).doc).toEqual(c.doc);
    const model = load(c.doc!).model!;
    const want = read(base + 'expected.jsonl')
      .trim()
      .split('\n')
      .map((s) => JSON.parse(s));
    const got = runScript(model, read(base + 'script.txt')).snapshots;
    expect(got).toHaveLength(want.length);
    got.forEach((s, i) => {
      expect(s.states).toEqual(want[i].states);
      expect(s.settled).toEqual(want[i].settled);
    });
    const invalid = load(read('modules/machine/test/core/invalid/' + name + '/case.ani'));
    const diagnostic = invalid.diagnostics.find((d) => d.code === 'undeclared-feature');
    expect(diagnostic).toMatchObject({ severity: 'error' });
    expect(diagnostic!.pointer).toMatch(/^\//);
    expect(diagnostic!.message.length).toBeGreaterThan(5);
    expect(diagnostic!.hint).toContain('machine');
    expect(JSON.stringify(jsonSchema())).toContain('machine');
  });
}
