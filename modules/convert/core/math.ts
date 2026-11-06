import { expression, evaluate, BindError, registerFunction } from '../../bind/core/expression.ts';
import type { InputScope } from '../../bind/core/expression.ts';
import type { ConverterContext } from './types.ts';
export interface MathFunction {
  arity: number;
  evaluate: (...args: number[]) => number;
}
const unary = [
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'log',
  'exp',
  'sqrt',
  'round',
  'ceil',
  'floor',
  'abs',
] as const;
export const mathFunctions = new Map<string, MathFunction>(
  unary.map((name) => [name, { arity: 1, evaluate: Math[name] }]),
);
mathFunctions.set('atan2', { arity: 2, evaluate: Math.atan2 });
mathFunctions.set('pow', { arity: 2, evaluate: Math.pow });
const aliases: Record<string, string> = {
  sine: 'sin',
  cosine: 'cos',
  tangent: 'tan',
  asine: 'asin',
  acosine: 'acos',
  atangent: 'atan',
  atangent2: 'atan2',
  squareRoot: 'sqrt',
  power: 'pow',
};
for (const [alias, name] of Object.entries(aliases))
  mathFunctions.set(alias, mathFunctions.get(name)!);
/** Adapter for the data agent's bind-language registration hook. */
export function registerMathFunctions(register: (name: string, fn: MathFunction) => void): void {
  for (const [name, fn] of mathFunctions) register(name, fn);
}
interface RandomState {
  seed: number;
  cache: Map<string, { input: unknown; value: number }>;
}
const randomKey = {};
export function seededRandom(
  ctx: ConverterContext,
  mode = 'always',
  input?: unknown,
  site = '',
): number {
  const storage = ctx.randomState ?? ctx.state;
  let state = storage.get(randomKey) as RandomState | undefined;
  if (!state) storage.set(randomKey, (state = { seed: (ctx.seed ?? 1) >>> 0, cache: new Map() }));
  const key = (ctx.key ?? '') + ':' + site;
  let cache = ctx.state.get(randomKey) as RandomState | undefined;
  if (!cache) ctx.state.set(randomKey, (cache = { seed: 1, cache: new Map() }));
  const previous = cache.cache.get(key);
  if (previous && (mode === 'once' || (mode === 'on-change' && Object.is(previous.input, input))))
    return previous.value;
  state.seed = (Math.imul(1664525, state.seed) + 1013904223) >>> 0;
  const value = state.seed / 4294967296;
  cache.cache.set(key, { input, value });
  return value;
}
// Use the active runtime parser/registry, including separately bundled bind entries.
let enabled = false;
export function setMathEnabled(value: boolean): void {
  enabled = value;
}
let parse = expression;
let current: { ctx: ConverterContext; mode: string; input: unknown; site: number } | undefined;
export function installFunctions(parser = expression, register = registerFunction): void {
  parse = parser;
  registerMathFunctions((name, fn) =>
    register(
      name,
      fn.arity,
      name === 'floor'
        ? fn.evaluate
        : Object.assign((...args: number[]) => fn.evaluate(...args), { enabled: () => enabled }),
    ),
  );
  register(
    'random',
    0,
    Object.assign(
      () =>
        current
          ? seededRandom(current.ctx, current.mode, current.input, String(current.site++))
          : 0,
      { enabled: () => enabled },
    ),
  );
}
installFunctions();
export function formula(
  source: string,
  types: ReadonlyMap<string, string> = new Map([['value', 'number']]),
) {
  if (source.length > 8192)
    throw new BindError('bind-syntax', 0, 'formula exceeds 8192 characters');
  const previousEnabled = enabled;
  enabled = true;
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(source, types);
  } finally {
    enabled = previousEnabled;
  }
  if (parsed.type !== 'number' && parsed.type !== 'bool')
    throw new BindError('bind-type', 0, 'formula must return number');
  return (scope: InputScope, ctx: ConverterContext, mode: string, input: unknown): number => {
    const previous = current;
    current = { ctx, mode, input, site: 0 };
    try {
      return Number(evaluate(parsed, scope));
    } finally {
      current = previous;
    }
  };
}
