import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { load } from '../../../../packages/core/src/index.ts';
import { compile } from '../../../../packages/markup/src/index.ts';
it('data-property-symbol-list-index: both spellings and diagnostic details', () => {
  const dir = new URL('./invalid/data-property-symbol-list-index/', import.meta.url);
  const expected = JSON.parse(readFileSync(new URL('expected.json', dir), 'utf8'));
  for (const ext of ['ani', 'animl']) {
    const source = readFileSync(new URL('case.' + ext, dir), 'utf8');
    const result = ext === 'ani' ? load(source) : compile(source);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ...expected,
        message: expect.stringMatching(/.+/),
        hint: expect.stringMatching(/.+/),
      }),
    );
  }
});
