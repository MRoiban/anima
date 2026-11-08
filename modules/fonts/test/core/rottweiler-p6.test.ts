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
const crafted = async (n: number, records: (i: number) => [number, number], instances: number) => {
  const { readFileSync } = await import('node:fs');
  const original = readFileSync('fixtures/fonts/anima-test.ttf');
  const tables = new Map<string, Buffer>();
  for (let i = 0; i < original.readUInt16BE(4); i++) {
    const p = 12 + 16 * i,
      at = original.readUInt32BE(p + 8);
    tables.set(
      original.toString('ascii', p, p + 4),
      original.subarray(at, at + original.readUInt32BE(p + 12)),
    );
  }
  // String storage starts at a 16-bit offset: after the records when they fit, else at 6.
  const base = 6 + n * 12 < 65536 ? 6 + n * 12 : 6;
  const name = Buffer.alloc(6 + n * 12 + 65535);
  name.writeUInt16BE(n, 2);
  name.writeUInt16BE(base, 4);
  for (let i = 0; i < n; i++) {
    const [id, length] = records(i);
    name.writeUInt16BE(3, 6 + i * 12);
    name.writeUInt16BE(id, 6 + i * 12 + 6);
    name.writeUInt16BE(length, 6 + i * 12 + 8);
  }
  const fvar = Buffer.alloc(36 + instances * 8);
  fvar.writeUInt32BE(0x10000, 0);
  fvar.writeUInt16BE(16, 4);
  fvar.writeUInt16BE(2, 6);
  fvar.writeUInt16BE(1, 8);
  fvar.writeUInt16BE(20, 10);
  fvar.writeUInt16BE(instances, 12);
  fvar.writeUInt16BE(8, 14);
  fvar.write('wght', 16);
  fvar.writeInt32BE(100 * 65536, 20);
  fvar.writeInt32BE(400 * 65536, 24);
  fvar.writeInt32BE(900 * 65536, 28);
  for (let i = 0; i < instances; i++) {
    fvar.writeUInt16BE(1000 + (i % 60000), 36 + i * 8);
    fvar.writeInt32BE(400 * 65536, 40 + i * 8);
  }
  tables.set('name', name);
  tables.set('fvar', fvar);
  const { sfnt } = await import('../../../../packages/cli/src/font/binary.ts');
  return sfnt(tables);
};
it('R4-03: name lookups index the name table once instead of rescanning it per instance', async () => {
  const { decodeFont } = await import('../../core/info.ts');
  const { Bytes } = await import('../../core/opentype/binary.ts');
  // 65,535 records × 65,535 instances: 4.3 billion record visits before the fix.
  const bytes = await crafted(65535, () => [0, 0], 65535);
  const check = Bytes.prototype.check;
  let reads = 0;
  Bytes.prototype.check = function (p, n) {
    if (++reads > 5_000_000) throw Error('unbounded name scans');
    return check.call(this, p, n);
  };
  try {
    expect(decodeFont(bytes).metrics.unitsPerEm).toBe(1000);
  } finally {
    Bytes.prototype.check = check;
  }
});
it('R4-03: overlapping long name records cannot amplify decoding past a bound', async () => {
  const { decodeFont } = await import('../../core/info.ts');
  // Every instance names its own 64 KiB record, all overlapping the same bytes.
  const bytes = await crafted(5000, (i) => [1000 + i, 65534], 5000);
  expect(() => decodeFont(bytes)).toThrowError(expect.objectContaining({ code: 'font-limit' }));
});
