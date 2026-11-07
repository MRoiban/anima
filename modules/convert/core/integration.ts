import { setMathEnabled } from './math.ts';
import type { Module } from '../../../packages/core/src/modules.ts';
import type { Player, PlayerExtension } from '../../../packages/core/src/player.ts';
import type { DataModule, Context } from '../../data/core/index.ts';
import type { createConverterRunner, Definitions } from './index.ts';
import type { ConverterValue } from './types.ts';

const bindingStates = {};
const busy = new WeakMap<Player, boolean>();
const runs = new WeakMap<object, ReturnType<typeof createConverterRunner>>();

// These maps belong to convert; no converter work is installed on converter-free models.
export function integration(
  registry: ReadonlyMap<string, Module>,
  create: typeof createConverterRunner,
): NonNullable<Module['prepare']> {
  const data = registry.get('data') as DataModule | undefined;
  const dispatch =
    (name: string) => (value: unknown, options: Record<string, unknown>, ctx: Context) => {
      const p = ctx.player;
      let states = ctx.state.get(bindingStates) as Map<string, Map<unknown, unknown>> | undefined;
      if (!states) ctx.state.set(bindingStates, (states = new Map()));
      const key = ctx.key ?? name;
      let state = states.get(key);
      if (!state) states.set(key, (state = new Map()));
      // A random stream is per player, while caches/interpolation use the binding-local state.
      return runs.get(p.model)!(name, value as ConverterValue, {
        player: p,
        time: p.time * 1000,
        direction: ctx.direction,
        key: ctx.direction,
        state,
        get: ctx.get,
        active: () => busy.set(p, true),
        random: () => p.randomSource.next(),
        options,
      });
    };
  return (model) => {
    setMathEnabled(!!model.doc.requires?.includes('convert'));
    if (!model.doc.requires?.includes('convert')) return;
    const defs = (model.doc.converters ?? {}) as Definitions;
    try {
      runs.set(model, create(defs));
    } catch {
      return;
    } // load reports precise diagnostics
    for (const name of Object.keys(defs))
      if (name !== '$comment') data?.registerConverter(name, dispatch(name));
    const previous = model.nesting;
    model.nesting = (p) => {
      const extension: PlayerExtension = previous?.(p) ?? {
        input: () => false,
        get: () => undefined,
        states: () => ({}),
        values: () => ({}),
        inspect: () => [],
        pointer() {},
        hits: () => undefined,
        step: () => ({ events: [], settled: true }),
      };
      const step = extension.step.bind(extension);
      extension.step = (dt) => {
        const result = step(dt);
        const active = busy.get(p);
        busy.set(p, false);
        return { events: result.events, settled: result.settled && !active };
      };
      return extension;
    };
  };
}
