import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compile, formatMarkup } from '../src/index.ts';

const root = new URL('../../../', import.meta.url);
const files = globSync(['examples/**/*.animl', 'spec/conformance/**/*.animl'], {
  cwd: fileURLToPath(root),
}).sort();

describe('authored AniML corpus', () => {
  it('includes the bell example and all conformance sources', () => {
    expect(files).toContain('examples/bell.animl');
    const cases = globSync('spec/conformance/*/case.ani', { cwd: fileURLToPath(root) }).sort();
    expect(cases).toHaveLength(33);
    for (const file of cases) expect(files).toContain(file.replace(/\.ani$/, '.animl'));
  });

  it.each(files)('%s builds byte for byte to its sibling .ani', (file) => {
    const source = readFileSync(new URL(file, root), 'utf8');
    const result = compile(source, { file });
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(readFileSync(new URL(file.replace(/\.animl$/, '.ani'), root), 'utf8'));
  });

  it.each(files)('%s is canonically formatted', (file) => {
    const source = readFileSync(new URL(file, root), 'utf8');
    const result = formatMarkup(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(source);
  });
});
