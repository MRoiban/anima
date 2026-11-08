// Rottweiler P6 regressions (design/rottweiler/P6-LEDGER.md).
import { expect, it } from 'vitest';
import { normalizeFont } from '../../../../packages/cli/src/font/container.ts';
it('R2-03: overlapping sfnt table records cannot normalize past the 32 MiB tool limit', () => {
  // 40 records share one 1 MiB range: 1 MiB in, 40 MiB of copied tables out.
  const n = 40,
    size = 1 << 20,
    head = 12 + n * 16,
    b = Buffer.alloc(head + size);
  b.writeUInt32BE(0x10000, 0);
  b.writeUInt16BE(n, 4);
  for (let i = 0; i < n; i++) {
    b.write('T' + String(i).padStart(3, '0'), 12 + i * 16, 'latin1');
    b.writeUInt32BE(head, 20 + i * 16);
    b.writeUInt32BE(size, 24 + i * 16);
  }
  expect(() => normalizeFont(b)).toThrowError(expect.objectContaining({ code: 'font-limit' }));
});
