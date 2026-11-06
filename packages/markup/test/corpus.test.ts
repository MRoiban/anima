import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { pendingReason } from '../../../tools/pending.ts';
import { compile, formatMarkup } from '../src/index.ts';

const root = new URL('../../../', import.meta.url);
const files = globSync(
  [
    'examples/**/*.animl',
    'modules/*/examples/**/*.animl',
    'spec/conformance/**/*.animl',
    'spec/draw-conformance/**/*.animl',
  ],
  {
    cwd: fileURLToPath(root),
  },
)
  .filter((f) => !f.startsWith('examples/lib/') && !pendingReason(new URL('./', new URL(f, root))))
  .sort();

describe('authored AniML corpus', () => {
  it('includes the bell example and all conformance sources', () => {
    expect(files).toContain('examples/bell.animl');
    for (const example of ['input/drag-slider', 'focus/traversal', 'machine/blend-pulse'])
      expect(files).toContain('modules/' + example.replace('/', '/examples/') + '.animl');
    const cases = globSync('spec/conformance/*/case.ani', { cwd: fileURLToPath(root) }).sort();
    // 364 baseline + 9 lists probes (8 capability + 1 count/inheritance) + 35 asset/fit/wrap/import probes.
    expect(cases).toHaveLength(408);
    for (const file of cases) expect(files).toContain(file.replace(/\.ani$/, '.animl'));
    const drawCases = globSync('spec/draw-conformance/*/case.ani', { cwd: fileURLToPath(root) });
    expect(drawCases).toHaveLength(3);
    for (const file of drawCases) expect(files).toContain(file.replace(/\.ani$/, '.animl'));
  });

  it.each(files)('%s builds byte for byte to its sibling .ani', (file) => {
    const source = readFileSync(new URL(file, root), 'utf8');
    const result = compile(source, {
      file,
      resolve: (path) => readFileSync(new URL(path, root), 'utf8'),
    });
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
