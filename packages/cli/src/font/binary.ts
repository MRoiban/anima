import type { Diagnostic } from '@anima-format/core';

export const MAX_FONT = 32 * 1024 * 1024;
export function fault(message: string, code = 'font-invalid'): never {
  throw Object.assign(new Error(message), {
    code,
    pointer: '',
    hint: 'use a valid, supported OpenType font',
  });
}
export function diagnostic(error: unknown, pointer = ''): Diagnostic {
  const e = error as Error & { code?: string; hint?: string };
  return {
    severity: 'error',
    code: e.code?.startsWith('font-') ? e.code : 'font-invalid',
    pointer,
    message: e.message || 'invalid font bytes',
    hint: e.hint ?? 'check the font source bytes and format',
  };
}
/** Every read is range checked, including sub-table offsets; bounded before allocation. */
export class Bytes {
  readonly data: Buffer;
  #reads = 2_000_000;
  constructor(data: Uint8Array) {
    this.data = Buffer.isBuffer(data) ? data : Buffer.from(data);
  }
  check(p: number, n: number): number {
    if (--this.#reads < 0) fault('font table operation limit', 'font-limit');
    if (
      !Number.isSafeInteger(p) ||
      !Number.isSafeInteger(n) ||
      p < 0 ||
      n < 0 ||
      p + n > this.data.length
    )
      fault('font table is truncated or has an invalid offset');
    return p;
  }
  u8(p: number): number {
    return this.data.readUInt8(this.check(p, 1));
  }
  i8(p: number): number {
    return this.data.readInt8(this.check(p, 1));
  }
  u16(p: number): number {
    return this.data.readUInt16BE(this.check(p, 2));
  }
  i16(p: number): number {
    return this.data.readInt16BE(this.check(p, 2));
  }
  u32(p: number): number {
    return this.data.readUInt32BE(this.check(p, 4));
  }
  i32(p: number): number {
    return this.data.readInt32BE(this.check(p, 4));
  }
  fixed(p: number): number {
    return this.i32(p) / 65536;
  }
  slice(p: number, n: number): Buffer {
    this.check(p, n);
    return this.data.subarray(p, p + n);
  }
  tag(p: number): string {
    return this.slice(p, 4).toString('ascii');
  }
}
export function checksum(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i += 4)
    sum =
      (sum +
        ((data[i] ?? 0) * 0x1000000 +
          ((data[i + 1] ?? 0) << 16) +
          ((data[i + 2] ?? 0) << 8) +
          (data[i + 3] ?? 0))) >>>
      0;
  return sum;
}
/** Canonical sfnt directory; deterministic padding and checkSumAdjustment. */
export function sfnt(tables: ReadonlyMap<string, Uint8Array>, flavor = 0x10000): Buffer {
  const entries = [...tables].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const n = entries.length;
  if (!n || n > 256) fault('invalid sfnt table count');
  let offset = 12 + n * 16;
  const out = Buffer.alloc(offset + entries.reduce((s, [, b]) => s + ((b.length + 3) & ~3), 0));
  out.writeUInt32BE(flavor);
  out.writeUInt16BE(n, 4);
  const power = 2 ** Math.floor(Math.log2(n));
  out.writeUInt16BE(power * 16, 6);
  out.writeUInt16BE(Math.log2(power), 8);
  out.writeUInt16BE((n - power) * 16, 10);
  let head = 0;
  entries.forEach(([tag, raw], i) => {
    const data = Buffer.from(raw);
    if (tag === 'head') {
      if (data.length < 54) fault('short head table');
      data.writeUInt32BE(0, 8);
      head = offset;
    }
    const p = 12 + i * 16;
    out.write(tag, p, 4, 'ascii');
    out.writeUInt32BE(checksum(data), p + 4);
    out.writeUInt32BE(offset, p + 8);
    out.writeUInt32BE(data.length, p + 12);
    data.copy(out, offset);
    offset += (data.length + 3) & ~3;
  });
  if (head) out.writeUInt32BE((0xb1b0afba - checksum(out)) >>> 0, head + 8);
  return out;
}
