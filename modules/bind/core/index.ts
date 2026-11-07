import { entries } from '../capabilities/data-bind-listener-actions/registry.ts';
import { after } from '../manifest.ts';
import type { Module } from '../../../packages/core/src/modules.ts';
import { resolveAddress } from '../../../packages/core/src/load.ts';
import { ptr } from '../../../packages/core/src/diag.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { BindError, expression, evaluate, registerFunction } from './expression.ts';
export {
  BindError,
  expression,
  evaluate,
  type Expression,
  type InputScope,
  registerFunction,
  functions,
} from './expression.ts';

let resolve = resolveAddress;
export const bind: Module & {
  registerFunction: typeof registerFunction;
  parse: typeof expression;
} = {
  registerFunction,
  parse: expression,
  name: 'bind',
  after,
  init(_modules, shared) {
    resolve = shared.resolveAddress;
    return { ...bind, init: undefined };
  },
  expression(source, types, expected, pointer, diag, read) {
    try {
      const e = expression(source, types);
      if (e.type !== expected && !(expected === 'number' && e.type === 'bool'))
        throw new BindError('bind-type', e.at, V ? `expected ${expected}, got ${e.type}` : '');
      for (const name of e.inputs) {
        read?.(name);
        const i = diag.list.findIndex(
          (d) => d.code === 'unused-input' && d.pointer === ptr('/inputs', name),
        );
        if (i >= 0) diag.list.splice(i, 1);
      }
      const run = (scope: Parameters<typeof evaluate>[1]) =>
        expected === 'number' ? Number(evaluate(e, scope)) : evaluate(e, scope);
      // Printed as its expression (anima inspect), not as compiled code.
      run.toString = () => source;
      return run;
    } catch (err) {
      if (!(err instanceof BindError)) throw err;
      diag.err(
        err.code,
        pointer,
        V && `${err.message} at character ${err.at + 1}`,
        V &&
          (err.code === 'bind-syntax'
            ? `check token ${JSON.stringify(source.slice(err.at).match(/^\S+/)?.[0] ?? 'end of expression')}; use values, arithmetic, comparisons, and/or/not or registered calls`
            : 'use declared non-trigger inputs and an expression matching the target type'),
      );
    }
  },
  entries: [
    ...entries,
    {
      target: 'document',
      shapes: { bind: { k: 'map', of: { k: 'str' } } },
      elements: {
        bind: {
          shape: {
            k: 'obj',
            p: { target: { k: 'str' }, value: { k: 'str' } },
            req: ['target', 'value'],
            feature: 'bind',
          },
        },
      },
    },
  ],
  load(model, raw, diag) {
    if (!raw.bind && !raw.requires?.includes('motion')) return;
    const bindings = Object.entries((raw.bind ?? {}) as Record<string, string>).filter(
      ([key, value]) =>
        key !== '$comment' &&
        typeof value === 'string' &&
        !(
          raw.requires?.includes('data') &&
          (value.includes('$') || value.includes('.properties.'))
        ),
    );
    const types = new Map([...model.inputs].map(([name, input]) => [name, input.type]));
    if (raw.requires?.includes('motion'))
      for (const layer of model.layers)
        for (const state of layer.states) {
          const source = raw.machine.layers[layer.name].states[state.name].time;
          if (source === undefined) continue;
          const pointer = ptr(ptr('/machine/layers', layer.name) + '/states', state.name) + '/time';
          const run = bind.expression!(source, types, 'number', pointer, diag);
          if (run) (model.timeBindings ??= new Map()).set(state, run as (scope: unknown) => number);
        }
    // Property references are forbidden, including attempted cycles. Valid sources are inputs only.
    const dependencies = new Map(
      bindings.map(([a, src]) => [a, src.match(/[a-z][a-zA-Z0-9-]*(?:\.[a-zA-Z0-9-]+)+/g) ?? []]),
    );
    const cyclic = (a: string): boolean => {
      const pending = [...(dependencies.get(a) ?? [])],
        seen = new Set<string>();
      while (pending.length) {
        const at = pending.pop()!;
        if (at === a) return true;
        if (seen.has(at)) continue;
        seen.add(at);
        for (const next of dependencies.get(at) ?? []) pending.push(next);
      }
      return false;
    };
    for (const [address, source] of bindings) {
      const pointer = ptr('/bind', address);
      try {
        if (cyclic(address))
          throw new BindError('bind-cycle', 0, V ? 'cyclic binding reference' : '');
        const addr = resolve(address, model.nodes, model.ids);
        if (Array.isArray(addr)) {
          diag.err(
            addr[0],
            pointer,
            addr[1],
            addr[2] || (V && 'choose an animatable node property'),
          );
          continue;
        }
        if (addr.prop.feature && !raw.requires?.includes(addr.prop.feature)) {
          diag.err(
            'undeclared-feature',
            pointer,
            V && 'binding target requires a module',
            V && `add "${addr.prop.feature}" to "requires"`,
          );
          continue;
        }
        const run = bind.expression!(source, types, addr.prop.type, pointer, diag);
        if (run) {
          model.addrs.set(address, addr);
          (model.bindings ??= new Map()).set(address, run);
        }
      } catch (err) {
        if (!(err instanceof BindError)) throw err;
        diag.err(
          err.code,
          pointer,
          V && `${err.message} at character ${err.at + 1}`,
          V && 'use input names, numbers, hex colours, arithmetic, min/max/clamp/mix',
        );
      }
    }
  },
};
