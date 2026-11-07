// Transition conditions (spec §8): term ("&&" term)*.

import type { Model, Value } from './load.ts';
import type { Diags } from './diag.ts';
import { VERBOSE as V } from './flags.ts';

export type Op = '==' | '!=' | '<' | '<=' | '>' | '>=';

export type Term =
  | { k: 'is'; name: string; not: boolean }
  | { k: 'cmp'; name: string; op: Op; value: number }
  | {
      k: 'expr';
      a: string;
      b: string;
      op: Op;
      test?: (scope: ReadonlyMap<string, Value>) => boolean;
    }
  | { k: 'end' }
  | { k: 'after'; s: number };

const NAME = '((?:\\$[a-zA-Z][a-zA-Z0-9-]*:)?\\$?[a-zA-Z][a-zA-Z0-9-]*(?:\\.[a-zA-Z0-9-]+)*)';
const NUM = '(-?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?)';
const IS = new RegExp(`^(!?)\\s*${NAME}$`);
const CMP = new RegExp(`^${NAME}\\s*(==|!=|<=|>=|<|>)\\s*${NUM}$`);
const AFTER = new RegExp(`^@after\\(\\s*${NUM}\\s*\\)$`);

/** Parse a condition. Returns its terms, or an error message. */
export function parseCondition(src: string): Term[] | string {
  const parts = [''];
  // Quoted literals are opaque: a string can contain the conjunction token.
  for (const token of src.split(/("(?:[^"\\]|\\.)*"|&&)/)) {
    if (token === '&&') parts.push('');
    else parts[parts.length - 1] += token;
  }
  const terms: Term[] = [];
  for (const raw of parts) {
    const t = raw.trim();
    let m: RegExpExecArray | null;
    if (t === '@end') terms.push({ k: 'end' });
    else if ((m = AFTER.exec(t))) {
      const s = Number(m[1]);
      if (s < 0) return V ? '@after needs a time ≥ 0' : '';
      terms.push({ k: 'after', s });
    } else if ((m = IS.exec(t))) terms.push({ k: 'is', name: m[2]!, not: m[1] === '!' });
    else if ((m = CMP.exec(t)))
      terms.push({ k: 'cmp', name: m[1]!, op: m[2] as Op, value: Number(m[3]) });
    else if ((m = /^(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)$/.exec(t)))
      terms.push({ k: 'expr', a: m[1]!, op: m[2] as Op, b: m[3]! });
    else return V ? (t ? `cannot read "${t}"` : 'empty term') : '';
  }
  return terms;
}

/** Typed scalar comparison shared by guard and bind expression evaluation. */
export function compare(x: Value, y: Value, op: string): boolean {
  return { '==': x === y, '!=': x !== y, '<': x < y, '<=': x <= y, '>': x > y, '>=': x >= y }[op]!;
}

/** Modules own literal type/name validation; core owns syntax and comparison. */
export function literalCondition(
  model: Model,
  term: Extract<Term, { k: 'expr' }>,
  at: string,
  d: Diags,
): boolean {
  const call = /^([a-z][a-zA-Z0-9-]*)\(\s*("(?:[^"\\]|\\.)*")\s*\)$/.exec(term.b.trim());
  const functions = model.guardLiterals;
  const resolve = call && functions && Object.hasOwn(functions, call[1]!) && functions[call[1]!];
  if (!resolve) return false;
  let value: Value | undefined;
  try {
    value = resolve(JSON.parse(call![2]!) as string, term.a.trim());
  } catch {
    // Malformed JSON string escapes are diagnosed with the other typed literal errors.
  }
  if (value === undefined || !['==', '!='].includes(term.op))
    d.err(
      'guard-literal',
      at,
      V && 'literal function does not match the property or comparison',
      V && 'use == or != with a declared name and the matching property type',
    );
  term.test = (scope) => compare(scope.get(term.a.trim())!, value!, term.op);
  return true;
}
