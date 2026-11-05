import { VERBOSE as V } from './flags.ts';

/** A load or validation finding (spec §2 "Strictness", codes in §11.3). */
export interface Diagnostic {
  code: string;
  severity: 'error' | 'warning';
  /** RFC 6901 JSON pointer to the offending value; "" is the document. */
  pointer: string;
  message: string;
  hint?: string;
}

type Text = string | false | undefined;

/** `s` in verbose builds, '' in the terse browser build (terser inlines the call away). */
export const text = (s: string): string => (V ? s : '');

export class Diags {
  readonly list: Diagnostic[] = [];
  private add(
    code: string,
    severity: Diagnostic['severity'],
    pointer: string,
    message: Text,
    hint: Text,
  ) {
    const x: Diagnostic = { code, severity, pointer, message: message || code };
    if (hint) x.hint = hint;
    this.list.push(x);
  }
  err(code: string, pointer: string, message?: Text, hint?: Text): void {
    this.add(code, 'error', pointer, message, hint);
  }
  warn(code: string, pointer: string, message?: Text, hint?: Text): void {
    this.add(code, 'warning', pointer, message, hint);
  }
  get failed(): boolean {
    return this.list.some((d) => d.severity === 'error');
  }
}
/** Append one reference token to a JSON pointer. */
export const ptr = (base: string, key: string | number): string =>
  base + '/' + String(key).replace(/~/g, '~0').replace(/\//g, '~1');

/** Edit distance, for "did you mean" hints. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length]!;
}

/** `did you mean "x"?` for the closest option, if it is close enough. */
export function suggest(word: string, options: Iterable<string>): string | undefined {
  let best: string | undefined;
  let bestD = Infinity;
  const lw = word.toLowerCase();
  for (const o of options) {
    const lo = o.toLowerCase();
    // A shared stem of 4+ letters (rotation → rotate) counts as close.
    const stem =
      lw.length > 3 &&
      lo.length > 3 &&
      (lw.startsWith(lo.slice(0, 5)) || lo.startsWith(lw.slice(0, 5)));
    const d = stem ? 1 : distance(lw, lo);
    if (d < bestD) [best, bestD] = [o, d];
  }
  return best !== undefined && bestD <= Math.max(2, Math.ceil(word.length / 3))
    ? `did you mean "${best}"?`
    : undefined;
}
