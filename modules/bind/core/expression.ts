// A small, independently implemented expression grammar. No eval or dynamic code generation.
import { lerpColor, parseHex } from '../../../packages/core/src/color.ts';
import type { Value } from '../../../packages/core/src/load.ts';

export type BindType = 'number' | 'bool' | 'color';
export type InputScope = ReadonlyMap<string, number | boolean>;
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
  const fail = (code = 'bind-syntax', message = 'expected an expression', where = at): never => {
    throw new BindError(code, where, message);
  };
  const next = () => {
    while (/\s/.test(source[pos] ?? '') && pos < source.length) pos++;
    at = pos;
    const match =
      /^(?:#[\da-fA-F]+|(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|[a-z][a-zA-Z0-9-]*|[+*/(),-])/.exec(
        source.slice(pos),
      );
    token = match?.[0] ?? '';
    if (token && ++count > 512) fail('bind-syntax', 'expression exceeds 512 tokens');
    if (!token && pos < source.length) fail('bind-syntax', 'unexpected character');
    pos += token.length;
  };
  const take = (s: string) => {
    if (token !== s) fail('bind-syntax', `expected ${s}`);
    next();
  };
  const node = (type: BindType, at: number, evaluate: Expression['evaluate']): Expression => ({
    type,
    at,
    inputs,
    evaluate,
  });
  const numeric = (e: Expression) => {
    if (e.type === 'color') fail('bind-type', 'expected a number or bool', e.at);
  };
  const number = (e: Expression, scope: InputScope) => Number(evaluate(e, scope));
  const parse = (minimum = 0): Expression => {
    if (++depth > 64) fail('bind-syntax', 'expression nesting exceeds 64');
    const start = at,
      word = token;
    next();
    let left: Expression;
    if (word === '(') {
      left = parse();
      take(')');
    } else if (word === '-' || word === '+') {
      const e = parse(3);
      numeric(e);
      left = node('number', start, (s) => (word === '-' ? -1 : 1) * number(e, s));
    } else if (/^\d/.test(word)) {
      const value = Number(word);
      if (!Number.isFinite(value)) fail('bind-syntax', 'number must be finite', start);
      left = node('number', start, () => value);
    } else if (word.startsWith('#')) {
      const value = parseHex(word);
      if (!value) fail('bind-syntax', 'expected #rgb, #rrggbb or #rrggbbaa', start);
      left = node('color', start, () => value!);
    } else if (/^[a-z]/.test(word)) {
      if (token === '(') {
        if (!['min', 'max', 'clamp', 'mix', 'floor', 'mod'].includes(word))
          fail('bind-syntax', 'unknown function', start);
        next();
        const args = [parse()];
        while ((token as string) === ',') {
          next();
          args.push(parse());
        }
        take(')');
        if (args.length !== (word === 'floor' ? 1 : ['min', 'max', 'mod'].includes(word) ? 2 : 3))
          fail('bind-syntax', 'wrong argument count', start);
        const [a, b, c] = args as [Expression, Expression, Expression];
        const color = word === 'mix' && a.type === 'color' && b.type === 'color';
        if (color) numeric(c);
        else args.forEach(numeric);
        left = node(color ? 'color' : 'number', start, (s) => {
          if (color)
            return lerpColor(
              a.evaluate(s) as import('../../../packages/core/src/color.ts').RGBA,
              b.evaluate(s) as import('../../../packages/core/src/color.ts').RGBA,
              number(c, s),
            );
          const x = number(a, s);
          if (word === 'floor') return Math.floor(x);
          const y = number(b, s);
          if (word === 'mod') return x - y * Math.floor(x / y);
          return word === 'min'
            ? Math.min(x, y)
            : word === 'max'
              ? Math.max(x, y)
              : word === 'clamp'
                ? Math.min(Math.max(x, y), number(c, s))
                : x + (y - x) * number(c, s);
        });
      } else {
        const type = types.get(word);
        if (!type) fail('unknown-input', `unknown input ${word}`, start);
        if (type !== 'number' && type !== 'bool')
          fail('bind-type', 'triggers are not binding values', start);
        inputs.add(word);
        left = node(type as BindType, start, (s) => s.get(word)!);
      }
    } else fail('bind-syntax', 'expected a value', start);
    while (true) {
      const op = token,
        precedence = op === '+' || op === '-' ? 1 : op === '*' || op === '/' ? 2 : 0;
      if (!precedence || precedence <= minimum) break;
      next();
      const a = left!,
        b = parse(precedence);
      numeric(a);
      numeric(b);
      left = node('number', a.at, (s) => {
        const x = number(a, s),
          y = number(b, s);
        return op === '+' ? x + y : op === '-' ? x - y : op === '*' ? x * y : x / y;
      });
    }
    depth--;
    return left!;
  };
  next();
  const result = parse();
  if (token) fail('bind-syntax', 'unexpected token');
  return result;
}

/** Reusable for component input bindings. Non-finite arithmetic resolves to zero. */
export function evaluate(e: Expression, scope: InputScope): Value {
  const v = e.evaluate(scope);
  return typeof v === 'number' && !Number.isFinite(v) ? 0 : v;
}
