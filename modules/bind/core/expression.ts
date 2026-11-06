// A small, independently implemented expression grammar. No eval or dynamic code generation.
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { lerpColor, parseHex } from '../../../packages/core/src/color.ts';
import { compare } from '../../../packages/core/src/cond.ts';
import type { Value } from '../../../packages/core/src/load.ts';

export type BindType = 'number' | 'bool' | 'color' | 'string';
export const functions = new Map<
  string,
  { arity: number; run: ((...args: number[]) => number) & { enabled?: () => boolean } }
>();
export function registerFunction(
  name: string,
  arity: number,
  run: (...args: number[]) => number,
): void {
  functions.set(name, { arity, run });
}
export type InputScope = ReadonlyMap<string, import('../../../packages/core/src/load.ts').Value>;
export interface Expression {
  type: BindType;
  at: number;
  inputs: Set<string>;
  evaluate(scope: InputScope): Value;
}
export class BindError extends Error {
  code: string;
  at: number;
  constructor(code: string, at: number, message: string) {
    super(message);
    this.code = code;
    this.at = at;
  }
}

/** Positions are zero-based UTF-16 offsets; names resolve against the supplied input types. */
export function expression(source: string, types: ReadonlyMap<string, string>): Expression {
  let pos = 0,
    token = '',
    at = 0,
    depth = 0,
    count = 0;
  const inputs = new Set<string>();
  const fail = (
    code = 'bind-syntax',
    message: string | false = V && 'expected an expression',
    where = at,
  ): never => {
    throw new BindError(code, where, message || '');
  };
  const next = () => {
    while (/\s/.test(source[pos] ?? '')) pos++;
    at = pos;
    const match =
      /^(?:\$[a-zA-Z][\w-]*(?::[a-zA-Z][\w-]*)?(?:\.[\w-]+)*|"(?:[^"\\]|\\.)*"|#[\da-fA-F]+|(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|[a-z][\w-]*(?:\.[\w-]+)*|[=!<>]=|[<>+*/(),-])/.exec(
        source.slice(pos),
      );
    token = match?.[0] ?? '';
    if (token && ++count > 512) fail(undefined, V && 'expression exceeds 512 tokens');
    if (!token && pos < source.length)
      fail(undefined, V && `unsupported token ${JSON.stringify(source[pos])}`);
    pos += token.length;
  };
  const close = () => {
    if (token !== ')') fail(undefined, V && 'expected )');
    next();
  };
  const node = (type: BindType, at: number, evaluate: Expression['evaluate']): Expression => ({
    type,
    at,
    inputs,
    evaluate,
  });
  const numeric = (e: Expression) => {
    if (e.type === 'string' || e.type === 'color')
      fail('bind-type', V && 'expected a number or bool', e.at);
  };
  const parse = (minimum = 0): Expression => {
    if (++depth > 64) fail(undefined, V && 'expression nesting exceeds 64');
    const start = at,
      word = token;
    next();
    let left: Expression;
    if (word === '(') {
      left = parse();
      close();
    } else if (word === 'not') {
      const e = parse(3);
      if (e.type !== 'bool') fail('bind-type', V && 'expected bool', start);
      left = node('bool', start, (s) => !e.evaluate(s));
    } else if (word === '-' || word === '+') {
      const e = parse(6);
      numeric(e);
      left = node('number', start, (s) => (word === '-' ? -1 : 1) * +evaluate(e, s));
    } else if (/^\d/.test(word)) {
      const value = +word;
      if (!isFinite(value)) fail(undefined, V && 'number must be finite', start);
      left = node('number', start, () => value);
    } else if (word[0] === '#') {
      const value = parseHex(word);
      if (!value) fail(undefined, V && 'expected #rgb, #rrggbb or #rrggbbaa', start);
      left = node('color', start, () => value!);
    } else if (word[0] === '"') {
      const value = JSON.parse(word) as string;
      left = node('string', start, () => value);
    } else if (/^[a-z$]/.test(word)) {
      if (token === '(') {
        const fn = functions.get(word);
        const arity =
          fn?.arity ??
          ({ min: 2, max: 2, clamp: 3, mix: 3, floor: 1, mod: 2 } as Record<string, number>)[word];
        if (fn?.run.enabled?.() === false) fail();
        if (arity === undefined) fail(undefined, V && 'unknown function', start);
        next();
        const args = (token as string) === ')' ? [] : [parse()];
        while ((token as string) === ',') {
          next();
          args.push(parse());
        }
        close();
        if (args.length !== arity) fail(undefined, V && 'wrong argument count', start);
        const [a, b, c] = args as [Expression, Expression, Expression];
        const color = word === 'mix' && a.type === 'color' && b.type === 'color';
        (color ? [c] : args).forEach(numeric);
        left = node(color ? 'color' : 'number', start, (s) => {
          if (color)
            return lerpColor(
              a.evaluate(s) as import('../../../packages/core/src/color.ts').RGBA,
              b.evaluate(s) as import('../../../packages/core/src/color.ts').RGBA,
              +evaluate(c, s),
            );
          if (fn) return fn.run(...args.map((a) => +evaluate(a, s)));
          const x = +evaluate(a, s);
          if (word === 'floor') return Math.floor(x);
          const y = +evaluate(b, s);
          if (word === 'mod') return x - y * Math.floor(x / y);
          return word === 'min'
            ? Math.min(x, y)
            : word === 'max'
              ? Math.max(x, y)
              : word === 'clamp'
                ? Math.min(Math.max(x, y), +evaluate(c, s))
                : x + (y - x) * +evaluate(c, s);
        });
      } else {
        const type = types.get(word);
        if (!type) fail('unknown-input', V && `unknown input ${word}`, start);
        if (!['number', 'bool', 'color', 'string'].includes(type!))
          fail('bind-type', V && 'triggers are not binding values', start);
        inputs.add(word);
        left = node(type as BindType, start, (s) => s.get(word)!);
      }
    } else fail(undefined, V && 'expected a value', start);
    while (true) {
      const op = token,
        precedence =
          op === 'or'
            ? 1
            : op === 'and'
              ? 2
              : /^[=!<>]/.test(op)
                ? 4
                : op === '+' || op === '-'
                  ? 5
                  : op === '*' || op === '/'
                    ? 6
                    : 0;
      if (precedence <= minimum) break;
      next();
      const a = left!,
        b = parse(precedence);
      if (
        precedence <= 2
          ? a.type !== 'bool' || b.type !== 'bool'
          : precedence === 4
            ? a.type !== b.type || (!['==', '!='].includes(op) && a.type !== 'number')
            : false
      )
        fail('bind-type', V && 'operator and operand types do not match', a.at);
      if (precedence > 4) [a, b].forEach(numeric);
      left = node(precedence <= 4 ? 'bool' : 'number', a.at, (s) => {
        const x = evaluate(a, s);
        if (precedence <= 2) return op === 'and' ? !!x && !!b.evaluate(s) : !!x || !!b.evaluate(s);
        const y = evaluate(b, s);
        if (precedence === 4) return compare(x, y, op);
        const n = +x,
          m = +y;
        return op === '+' ? n + m : op === '-' ? n - m : op === '*' ? n * m : n / m;
      });
    }
    depth--;
    return left!;
  };
  next();
  const result = parse();
  if (token) fail(undefined, V && `unsupported token ${JSON.stringify(token)}`);
  return result;
}

/** Reusable for component input bindings. Non-finite arithmetic resolves to zero. */
export function evaluate(e: Expression, scope: InputScope): Value {
  const v = e.evaluate(scope);
  return typeof v === 'number' && !isFinite(v) ? 0 : v;
}
