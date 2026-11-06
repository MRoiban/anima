import type { Diagnostic } from '../../../packages/core/src/diag.ts';
// Integration seam: data currently exports no code table. Kept in one host table until data
// can export it; the values intentionally match the data diagnostics (see REPORT.md).
export const codes = {
  type: 'data-type',
  cycle: 'data-cycle',
  path: 'data-path',
  readonly: 'data-readonly',
  model: 'data-model',
  instance: 'data-instance',
  asset: 'data-asset',
} as const;
export class DataError extends Error {
  override readonly name = 'DataError';
  readonly severity = 'error';
  readonly code: string;
  readonly pointer: string;
  readonly hint: string;
  constructor(code: string, pointer: string, message: string, hint: string) {
    super(message);
    this.code = code;
    this.pointer = pointer;
    this.hint = hint;
  }
  static from(d: Diagnostic): DataError {
    return new DataError(d.code, d.pointer, d.message, d.hint ?? 'check the data declaration');
  }
}
export function fail(kind: keyof typeof codes, path: string, message: string): never {
  throw new DataError(
    codes[kind],
    '/data/' + path.replace(/~/g, '~0').replace(/\//g, '~1'),
    message,
    'use a declared, writable property of the requested type and an instance from this player',
  );
}
