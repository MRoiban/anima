import type { Diagnostic } from '../../../packages/core/src/diag.ts';
import { dataCodes as codes } from '../../data/core/errors.ts';
export { dataCodes as codes } from '../../data/core/errors.ts';
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
