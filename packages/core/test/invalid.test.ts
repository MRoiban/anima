// One broken document per diagnostic code (spec §11.3). Each file is named after the code it must
// produce and says where in its "$comment": "expect <code> at <pointer>".
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { load } from '../src/index.ts';

const DIR = new URL('./invalid/', import.meta.url);
const files = readdirSync(DIR).filter((f) => f.endsWith('.ani'));

/** Codes only `anima validate` reports (they need a JSON tokenizer or SHA-256); tested in the CLI. */
const CLI_ONLY = ['duplicate-key', 'hash-mismatch'];

function at(doc: unknown, pointer: string): unknown {
  let v = doc;
  for (const tok of pointer.split('/').slice(1)) {
    const k = tok.replace(/~1/g, '/').replace(/~0/g, '~');
    v = (v as Record<string, unknown>)?.[k];
  }
  return v;
}

describe('invalid documents', () => {
  it.each(files)('%s', (file) => {
    const text = readFileSync(new URL(file, DIR), 'utf8');
    const code = file.split('.')[0]!;
    const { model, diagnostics } = load(text);
    const want =
      code === 'json-syntax' ? '' : (JSON.parse(text).$comment as string).split(' at ')[1]!;
    const hit = diagnostics.find((d) => d.code === code);
    expect(hit, JSON.stringify(diagnostics, null, 1)).toBeDefined();
    expect(hit!.pointer).toBe(want);
    expect(hit!.message.length).toBeGreaterThan(0);
    if (hit!.severity === 'error') expect(model).toBeUndefined();
    else expect(model).toBeDefined();
    if (code !== 'json-syntax') {
      const doc = JSON.parse(text);
      for (const d of diagnostics)
        expect(at(doc, d.pointer), `${d.code} ${d.pointer}`).toBeDefined();
    }
  });

  it('covers every code in the spec', () => {
    const spec = readFileSync(new URL('../../../spec/SPEC.md', import.meta.url), 'utf8');
    const table = spec.slice(spec.indexOf('### 11.3'), spec.indexOf('## 12.'));
    const codes = [...table.matchAll(/^\| `([a-z-]+)` \|/gm)].map((m) => m[1]!);
    expect(codes.length).toBeGreaterThan(30);
    const tested = new Set(files.map((f) => f.split('.')[0]));
    expect(codes.filter((c) => !tested.has(c) && !CLI_ONLY.includes(c))).toEqual([]);
  });
});
