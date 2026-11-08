import { VERBOSE as V } from '../../../../packages/core/src/flags.ts';
import type { Diagnostic } from '../../../../packages/core/src/index.ts';

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
  readonly data: Uint8Array;
  private view: DataView;
  #reads = 2_000_000;
  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }
  check(p: number, n: number): number {
    if (--this.#reads < 0) fault(V ? 'font table operation limit' : '', 'font-limit');
    if (
      !Number.isSafeInteger(p) ||
      !Number.isSafeInteger(n) ||
      p < 0 ||
      n < 0 ||
      p + n > this.data.length
    )
      fault(V ? 'font table is truncated or has an invalid offset' : '');
    return p;
  }
  u8(p: number): number {
    return this.view.getUint8(this.check(p, 1));
  }
  i8(p: number): number {
    return this.view.getInt8(this.check(p, 1));
  }
  u16(p: number): number {
    return this.view.getUint16(this.check(p, 2));
  }
  i16(p: number): number {
    return this.view.getInt16(this.check(p, 2));
  }
  u32(p: number): number {
    return this.view.getUint32(this.check(p, 4));
  }
  i32(p: number): number {
    return this.view.getInt32(this.check(p, 4));
  }
  fixed(p: number): number {
    return this.i32(p) / 65536;
  }
  slice(p: number, n: number): Uint8Array {
    this.check(p, n);
    return this.data.subarray(p, p + n);
  }
  tag(p: number): string {
    return String.fromCharCode(...this.slice(p, 4));
  }
}
