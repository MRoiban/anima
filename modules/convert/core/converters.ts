import { parseHex, lerpColor } from '../../../packages/core/src/color.ts';
import { formula, seededRandom, mathFunctions } from './math.ts';
import {
  bad,
  choice,
  numeric,
  string,
  numberOption as opt,
  mismatch,
  ConverterError,
} from './types.ts';
import type { Converter, ConverterContext, ConverterOptions, ConverterValue } from './types.ts';
export const converterRegistry = new Map<string, Converter>();
export function registerConverter(name: string, converter: Converter): void {
  converterRegistry.set(name, converter);
}
function pair(o: ConverterOptions, key: string, fallback: number[]): number[] {
  const v = o[key] ?? fallback;
  if (
    !Array.isArray(v) ||
    v.length !== 2 ||
    v.some((n) => typeof n !== 'number' || !Number.isFinite(n))
  )
    bad('expected two finite numbers', key);
  return v as number[];
}
function integer(o: ConverterOptions, key: string, fallback: number, max = 10000): number {
  const n = opt(o, key, fallback);
  if (!Number.isInteger(n) || n < 0 || n > max) bad(`expected integer 0..${max}`, key);
  return n;
}
function format(value: ConverterValue, o: ConverterOptions): string {
  const decimals = integer(o, 'decimals', 0, 100);
  const [integerPart, fraction] = numeric(value).toFixed(decimals).split('.');
  let whole = integerPart;
  if (o.grouping) whole = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return whole + (fraction === undefined ? '' : '.' + fraction);
}
function color(value: ConverterValue): import('../../../packages/core/src/color.ts').RGBA {
  const c =
    typeof value === 'string'
      ? parseHex(value)
      : Array.isArray(value) &&
          value.length === 4 &&
          value.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 255)
        ? value
        : undefined;
  return (
    (c as import('../../../packages/core/src/color.ts').RGBA) ??
    mismatch('hex colour or RGBA tuple')
  );
}
interface Interpolation {
  target: ConverterValue;
  from: ConverterValue;
  value: ConverterValue;
  start: number;
}
const interpolation = new WeakMap<object, Map<string, Interpolation>>();
const formulaCache = new Map<string, ReturnType<typeof formula>>();
const implementations: Record<string, Converter> = {
  range: (v, o) => {
    const [a, b] = pair(o, 'from', [0, 1]) as [number, number],
      [c, d] = pair(o, 'to', [0, 1]) as [number, number];
    if (a === b) bad('source range must have nonzero width', 'from');
    let t = (numeric(v) - a) / (b - a);
    if (o.modulo) t = ((t % 1) + 1) % 1;
    if (o.clamp) t = Math.max(0, Math.min(1, t));
    if (o.reverse) t = 1 - t;
    return c + (d - c) * t;
  },
  round: (v, o) => {
    const f = 10 ** integer(o, 'decimals', 0, 100);
    const n = numeric(v) * f;
    return (
      (choice(o, 'mode', ['round', 'floor', 'ceil'], 'round') === 'floor'
        ? Math.floor(n)
        : o.mode === 'ceil'
          ? Math.ceil(n)
          : Math.round(n)) / f
    );
  },
  negate: (v) => (typeof v === 'boolean' ? !v : mismatch('boolean')),
  'to-number': (v) => {
    if (typeof v !== 'string' && typeof v !== 'boolean' && typeof v !== 'number')
      mismatch('number, boolean or numeric string');
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  },
  'to-string': (v) => String(v),
  'number-format': format,
  'color-format': (v, o) => {
    const c = color(v).map(Math.round);
    return choice(o, 'format', ['hex', 'hexa', 'rgb', 'rgba'], 'hex').startsWith('hex')
      ? '#' +
          c
            .slice(0, o.format === 'hexa' ? 4 : 3)
            .map((n) => n.toString(16).padStart(2, '0'))
            .join('')
      : o.format === 'rgba'
        ? `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3]! / 255})`
        : `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  },
  pad: (v, o) => {
    const text = string(v),
      length = integer(o, 'length', 0),
      fill = o.fill ?? ' ';
    if (typeof fill !== 'string' || !fill.length) bad('fill must be a nonempty string', 'fill');
    return choice(o, 'side', ['start', 'end'], 'start') === 'start'
      ? text.padStart(length, fill as string)
      : text.padEnd(length, fill as string);
  },
  trim: (v, o) => {
    const t = string(v),
      mode = choice(o, 'mode', ['start', 'end', 'all', 'none'], 'all');
    return mode === 'none'
      ? t
      : mode === 'start'
        ? t.trimStart()
        : mode === 'end'
          ? t.trimEnd()
          : t.trim();
  },
  template: (v, o) => {
    if (typeof o.text !== 'string') bad('text is required', 'text');
    const open = o.open ?? '{',
      close = o.close ?? '}';
    if (typeof open !== 'string' || typeof close !== 'string' || !open || !close)
      bad('delimiters must be nonempty strings');
    const args = Array.isArray(v) ? v : [v];
    let result = '',
      rest = o.text as string;
    while (rest.includes(open as string)) {
      const i = rest.indexOf(open as string);
      result += rest.slice(0, i);
      rest = rest.slice(i + (open as string).length);
      const j = rest.indexOf(close as string);
      if (j < 0) {
        result += open + rest;
        rest = '';
        break;
      }
      const token = rest.slice(0, j),
        match = /^(\d+)(?::(\d+))?$/.exec(token);
      if (!match) bad('expected positional argument, optionally :decimals', 'text');
      const arg = args[Number(match![1])];
      if (arg === undefined) mismatch('template argument');
      result +=
        match![2] === undefined
          ? String(arg)
          : format(arg!, { decimals: Number(match![2]), grouping: o.grouping });
      rest = rest.slice(j + (close as string).length);
    }
    return result + rest;
  },
  'remove-zeros': (v) => string(v).replace(/(\.\d*?[1-9])0+(?=$|[^\d])|\.0+(?=$|[^\d])/g, '$1'),
  'enum-to-index': (v, o) => {
    if (!Array.isArray(o.values)) bad('values array is required', 'values');
    const index = (o.values as unknown[]).indexOf(v);
    return index < 0 ? mismatch('declared enum value') : index;
  },
  'list-length': (v) => (Array.isArray(v) ? v.length : mismatch('list')),
  'number-to-list': (v, o) => {
    const n = numeric(v);
    if (!Number.isInteger(n) || n < 0 || n > 10000) mismatch('list length 0..10000');
    return Array.from({ length: n }, (_, i) =>
      o.item === undefined ? i : (o.item as ConverterValue),
    );
  },
  trigger: (v) => (typeof v === 'boolean' ? v : Math.trunc(numeric(v))),
  'degrees-to-radians': (v) => (numeric(v) * Math.PI) / 180,
  normalize: (v, o) => {
    const [a, b] = pair(o, 'from', [0, 1]) as [number, number];
    if (a === b) bad('source range must have nonzero width', 'from');
    return (numeric(v) - a) / (b - a);
  },
  formula: (v, o, ctx) => {
    if (typeof o.expression !== 'string') bad('expression is required', 'expression');
    const mode = choice(o, 'random', ['always', 'once', 'on-change'], 'always');
    const scope = new Map(ctx.values);
    scope.set('value', numeric(v));
    const types = new Map(
      [...scope].map(([name, value]) => [name, typeof value === 'boolean' ? 'bool' : 'number']),
    );
    const key = JSON.stringify([o.expression, [...types]]);
    let run = formulaCache.get(key);
    if (!run) {
      run = formula(o.expression as string, types);
      if (formulaCache.size > 256) formulaCache.clear();
      formulaCache.set(key, run);
    }
    return run(scope, ctx, mode, v);
  },
  calculate: (v, o, ctx) => {
    const n = numeric(v),
      operand = opt(o, 'operand', 1),
      operation = o.operation;
    if (operation === 'add') return n + operand;
    if (operation === 'subtract') return n - operand;
    if (operation === 'multiply') return n * operand;
    if (operation === 'divide') return operand === 0 ? 0 : n / operand;
    if (operation === 'modulo') return operand === 0 ? 0 : n - operand * Math.floor(n / operand);
    if (operation === 'random')
      return seededRandom(ctx, choice(o, 'random', ['always', 'once', 'on-change'], 'always'), v);
    const fn = mathFunctions.get(String(operation));
    if (!fn) bad('unknown calculation', 'operation');
    return fn!.evaluate(n, ...(fn!.arity === 2 ? [operand] : []));
  },
  interpolate: (v, o, ctx) => {
    const duration = opt(o, 'duration', 0);
    if (duration < 0) bad('duration must be nonnegative', 'duration');
    const target = typeof v === 'number' ? numeric(v) : [...color(v)];
    let states = interpolation.get(ctx.player);
    if (!states) interpolation.set(ctx.player, (states = new Map()));
    const key = ctx.key ?? 'default';
    let s = states.get(key);
    const equal = (a: ConverterValue, b: ConverterValue) => JSON.stringify(a) === JSON.stringify(b);
    const sample = (state: Interpolation): ConverterValue => {
      const t = duration === 0 ? 1 : Math.max(0, Math.min(1, (ctx.time - state.start) / duration));
      return typeof state.from === 'number' && typeof state.target === 'number'
        ? state.from + (state.target - state.from) * t
        : lerpColor(color(state.from), color(state.target), t);
    };
    if (!s) {
      s = { from: target, target, value: target, start: ctx.time };
      states.set(key, s);
    } else if (!equal(target, s.target)) {
      const from = sample(s);
      if ((typeof from === 'number') !== (typeof target === 'number'))
        mismatch('same interpolation type');
      s.from = from;
      s.target = target;
      s.start = ctx.time;
    }
    return (s.value = sample(s));
  },
};
for (const [name, fn] of Object.entries(implementations)) registerConverter(name, fn);
export function convertValue(
  type: string,
  value: ConverterValue,
  options: ConverterOptions = {},
  ctx: ConverterContext = { player: {}, time: 0 },
): ConverterValue {
  const fn = converterRegistry.get(type);
  if (!fn)
    throw new ConverterError('convert-unknown-type', `unknown converter type ${type}`, 'type');
  const result = fn!(value, options, ctx);
  return typeof result === 'number' && !Number.isFinite(result) ? 0 : result;
}
