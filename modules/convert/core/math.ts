import { expression, evaluate, BindError } from '../../bind/core/expression.ts';
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
const randomStates = new WeakMap<object, RandomState>();
export function seededRandom(
  ctx: ConverterContext,
  mode = 'always',
  input?: unknown,
  site = '',
): number {
  let state = randomStates.get(ctx.player);
  if (!state)
    randomStates.set(ctx.player, (state = { seed: (ctx.seed ?? 1) >>> 0, cache: new Map() }));
  const key = (ctx.key ?? '') + ':' + site,
    previous = state.cache.get(key);
  if (previous && (mode === 'once' || (mode === 'on-change' && Object.is(previous.input, input))))
    return previous.value;
  state.seed = (Math.imul(1664525, state.seed) + 1013904223) >>> 0;
  const value = state.seed / 4294967296;
  state.cache.set(key, { input, value });
  return value;
}
/** Compile the existing bind grammar, lifting additional calls into typed synthetic inputs.
 * No eval, Function, host globals, or unbounded recursive expansion. */
export function formula(
  source: string,
  types: ReadonlyMap<string, string> = new Map([['value', 'number']]),
) {
  if (source.length > 8192)
    throw new BindError('bind-syntax', 0, 'formula exceeds 8192 characters');
  let serial = 0;
  const compile = (
    text: string,
    depth = 0,
  ): ((scope: InputScope, ctx: ConverterContext, mode: string, input: unknown) => number) => {
    if (depth > 64) throw new BindError('bind-syntax', 0, 'formula nesting exceeds 64');
    const lifted: { name: string; run: ReturnType<typeof compile> }[] = [];
    const localTypes = new Map(types);
    let rewritten = '',
      i = 0;
    while (i < text.length) {
      const match = /^([a-z][a-zA-Z0-9-]*)\s*\(/.exec(text.slice(i));
      if (!match || (!mathFunctions.has(match[1]!) && match[1] !== 'random')) {
        rewritten += text[i++];
        continue;
      }
      const name = match[1]!,
        start = i;
      i += match[0].length;
      let nesting = 1,
        argStart = i;
      const args: string[] = [];
      while (i < text.length && nesting) {
        const c = text[i];
        if (c === '(') nesting++;
        if (c === ')') nesting--;
        if ((c === ',' && nesting === 1) || nesting === 0) {
          if (i > argStart || args.length) args.push(text.slice(argStart, i));
          argStart = i + 1;
        }
        i++;
      }
      const fn = mathFunctions.get(name);
      if (nesting || args.length !== (fn?.arity ?? 0))
        throw new BindError('bind-syntax', start, 'wrong math argument count');
      const calls = args.map((a) => compile(a, depth + 1));
      let synthetic: string;
      do {
        synthetic = 'convertArg' + serial++;
      } while (localTypes.has(synthetic));
      localTypes.set(synthetic, 'number');
      lifted.push({
        name: synthetic,
        run: (scope, ctx, mode, input) =>
          fn
            ? fn.evaluate(...calls.map((c) => c(scope, ctx, mode, input)))
            : seededRandom(ctx, mode, input, synthetic),
      });
      rewritten += synthetic;
    }
    const parsed = expression(rewritten, localTypes);
    if (parsed.type === 'color') throw new BindError('bind-type', 0, 'formula must return number');
    return (scope, ctx, mode, input) => {
      const values = new Map(scope);
      for (const call of lifted) {
        const result = call.run(scope, ctx, mode, input);
        values.set(call.name, Number.isFinite(result) ? result : 0);
      }
      return Number(evaluate(parsed, values));
    };
  };
  return compile(source);
}
