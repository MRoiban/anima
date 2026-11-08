// Rottweiler P6 regressions (design/rottweiler/P6-LEDGER.md).
import { expect, it } from 'vitest';
import { documentCharacters } from '../../../../packages/cli/src/font/document.ts';
it('R1-10: used-glyph subsetting keeps the obscured field mask character', () => {
  const field = (obscured: boolean) => ({
    nodes: [{ id: 'pw', type: 'text', runs: [{ text: 'secret' }], textInput: { obscured } }],
  });
  expect(documentCharacters(field(true))).toContain('•');
  expect(documentCharacters(field(false))).toBe('secret');
});
