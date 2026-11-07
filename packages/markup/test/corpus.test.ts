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
    // 364 baseline + 9 lists + 37 assets (incl. FLAC/MP3) + 10 data-extras + 9 component-extras + 4 seam
    // probes + 2 benchmark-fix probes + 1 live component paint + 3 P3b-5 reduced-motion + 1 tooling input/data + 5 listener writes + 1 asset literal + 1 image binding.
    // P3b-6: 2 shared-source seed probes. P3b-7: simple semantic bounds, semantic ordering and action edges.
    // [P3b-9] 35 independent semantic role/state/property/trait/action probes.
    // [P3b-10b] Converter definitions survive repeat model clones.
    // [P3b-10a] spoken slider values, native headless keys and narrower input limits.
    // [P3c-8] Painted-center spatial focus and ancestor exclusion.
    // [BF-2] Manual tab activation keys. [BF-1] Inherited library data and qualified/legacy component lookup. [P6-3] Generated font asset declaration. [BF-4] Additional roles, radio keys and repeated data writes. [BF-3] Empty component library and settled derived guard. [P6-1] 29 text capability probes.
    // seam(P6-5): fourteen effect/direction probes plus negative-tracking background.
    // seam(P6-8): seven font probes now have real resource/text expectations.
    // seam(P6-7): inferred-text and listener-index conformance probes.
    // seam(P6-6): 14 independent text-field commit/semantic probes.
    expect(cases).toHaveLength(569);
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
