export type ConverterValue = number | boolean | string | null | readonly ConverterValue[];
export interface ConverterContext {
  /** Stable identity owned by the player; never shared between players. */
  player: object;
  /** Absolute player time in milliseconds. */
  time: number;
  seed?: number;
  /** Stable binding identity; separates uses of the same named converter. */
  key?: string;
  values?: ReadonlyMap<string, number | boolean>;
}
export type ConverterOptions = Record<string, unknown>;
export type Converter = (
  value: ConverterValue,
  options: ConverterOptions,
  ctx: ConverterContext,
) => ConverterValue;
export interface ConverterDefinition extends ConverterOptions {
  type: string;
}
export interface ConverterGroup {
  chain: string[];
}
export class ConverterError extends Error {
  code: string;
  option: string;
  constructor(code: string, message: string, option = '') {
    super(message);
    this.code = code;
    this.option = option;
  }
}
export const bad = (message: string, option = ''): never => {
  throw new ConverterError('convert-options', message, option);
};
export const mismatch = (expected: string): never => {
  throw new ConverterError('convert-type', `expected ${expected}`);
};
export const numeric = (value: ConverterValue): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : mismatch('finite number');
export const string = (value: ConverterValue): string =>
  typeof value === 'string' ? value : mismatch('string');
export function numberOption(o: ConverterOptions, key: string, fallback: number): number {
  const v = o[key] ?? fallback;
  return typeof v === 'number' && Number.isFinite(v) ? v : bad('expected finite number', key);
}
export function choice(
  o: ConverterOptions,
  key: string,
  choices: string[],
  fallback: string,
): string {
  const v = o[key] ?? fallback;
  return typeof v === 'string' && choices.includes(v)
    ? v
    : bad(`expected ${choices.join('|')}`, key);
}
