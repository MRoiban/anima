import { installRandom } from '../../../packages/core/src/random.ts';
import type { Module } from '../../../packages/core/src/modules.ts';
import type { Diags } from '../../../packages/core/src/diag.ts';
import { ptr } from '../../../packages/core/src/diag.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { inputExpression, type ActionM, type StateM } from '../../../packages/core/src/load.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import { BindError, expression, evaluate } from '../../bind/core/expression.ts';
import { after } from '../manifest.ts';
import { entries } from './registry.ts';
import { MachinePolicy, install } from './runtime.ts';
import {
  states,
  anyEdges,
  compiledActions,
  transitions,
  type Source,
  type Actions,
  type StateOptions,
  type TransitionOptions,
} from './types.ts';
export type { Actions, StateOptions, TransitionOptions } from './types.ts';
const list = (x: string | string[] | undefined): string[] =>
  x === undefined ? [] : typeof x === 'string' ? [x] : x;
const err = (
  d: Diags,
  code: string,
  p: string,
  message: string | false,
  hint: string | false = 'check the machine field and its referenced input, state or timeline',
) => d.err(code, p, V && message, V && hint);
let compileValue = inputExpression;
export const machine: Module = {
  name: 'machine',
  after,
  entries,
  init(_modules, shared) {
    installRandom(shared.Player);
    install(shared.sampleTrack, shared.mixValues);
    compileValue = shared.inputExpression;
    return { ...machine, init: undefined };
  },
  load(model, raw, d) {
    if (!raw.requires?.includes('machine')) return;
    const used = new Set<string>();
    const input = (name: string, type: string, p: string) => {
      const i = model.inputs.get(name);
      if (!i) err(d, 'unknown-input', p, V && `unknown machine input ${name}`);
      else if (i.type !== type) err(d, 'input-type', p, V && `expected ${type} input`);
      used.add(name);
      return i;
    };
    const actions = (a: Actions | undefined, p: string) => {
      if (!a) return;
      const set: ActionM['set'] = [];
      for (const name of list(a?.fire)) input(name, 'trigger', p + '/fire');
      for (const name of list(a?.toggle)) input(name, 'bool', p + '/toggle');
      for (const [name, val] of Object.entries(a?.set ?? {})) {
        if (name === '$comment') continue;
        const pointer = ptr(p + '/set', name);
        if (typeof val === 'string') {
          const i = model.inputs.get(name);
          input(name, i && i.type !== 'trigger' ? i.type : 'number', pointer);
          if (i && i.type !== 'trigger') {
            const evaluate = compileValue(model, val, i.type, pointer, d, (n) => used.add(n));
            if (evaluate) set.push([name, evaluate]);
          }
        } else {
          input(name, typeof val === 'boolean' ? 'bool' : 'number', pointer);
          set.push([name, val]);
        }
      }
      compiledActions.set(a, { fire: list(a.fire), toggle: list(a.toggle), set, emit: a.emit });
    };
    const number = (src: Source | undefined, p: string): ((p: Player) => number) => {
      if (src === undefined || typeof src === 'number') return () => src ?? 1;
      if (typeof src === 'string') {
        input(src, 'number', p);
        return (p) => Number(p.get(src));
      }
      if (!raw.requires.includes('bind'))
        err(
          d,
          'undeclared-feature',
          p,
          V && 'machine data sources use bind until P4e',
          V && 'add "bind" to requires',
        );
      try {
        const e = expression(src.bind, new Map([...model.inputs].map(([n, i]) => [n, i.type])));
        if (e.type !== 'number')
          throw new BindError('bind-type', 0, 'expected a numeric blend expression');
        for (const name of e.inputs) used.add(name);
        return (p) => Number(evaluate(e, new Map([...e.inputs].map((n) => [n, p.get(n)!]))));
      } catch (e) {
        if (!(e instanceof BindError)) throw e;
        err(d, e.code, p + '/bind', e.message, V && 'use a numeric input expression');
        return () => 0;
      }
    };
    const timeline = (name: string, p: string) => {
      const index = model.timelines.findIndex((t) => t.name === name);
      if (index < 0) err(d, 'unknown-timeline', p, V && `unknown blend timeline ${name}`);
      return index;
    };
    for (const layer of model.layers) {
      const rawStates = raw.machine.layers[layer.name].states;
      const any: StateM[] = [];
      for (const state of layer.states) {
        const r = rawStates[state.name] as StateOptions;
        const p = ptr(ptr('/machine/layers', layer.name) + '/states', state.name);
        const info = {
          ...r,
          axis: r.mix?.axis === undefined ? undefined : number(r.mix.axis, p + '/mix/axis'),
        };
        states.set(state, info);
        if (r.reset === false)
          err(
            d,
            'machine-state',
            p + '/reset',
            V && 'reset false is not a supported suspension policy',
            V && 'omit reset or use reset: true',
          );
        actions(r.enterActions, p + '/enterActions');
        actions(r.exitActions, p + '/exitActions');
        if (r.kind && (state.play !== undefined || state.pose?.size || r.mix))
          err(
            d,
            'machine-state',
            p + '/kind',
            V && 'special states require an empty pose',
            V && 'use pose: {} and omit play/mix',
          );
        if (r.kind === 'any') {
          any.push(state);
          if (layer.states[layer.initial] === state)
            err(d, 'machine-state', p + '/kind', V && 'any state cannot be initial');
        }
        if (r.kind === 'exit' && state.on.length)
          err(
            d,
            'machine-state',
            p + '/on',
            V && 'terminal state has no outgoing transitions',
            V && 'remove its on list',
          );
        const clock = rawStates[state.name];
        if (r.mix && (clock.hold || clock.time !== undefined))
          err(
            d,
            'machine-clock',
            p + '/mix',
            V && 'blend children need autonomous clocks',
            V && 'omit hold/time on a blend state',
          );
        if (
          r.kind === 'random' &&
          !Number.isFinite(state.on.reduce((sum, _t, i) => sum + (clock.on[i].weight ?? 1), 0))
        )
          err(
            d,
            'machine-state',
            p + '/on',
            V && 'random weight sum must be finite',
            V && 'reduce the random weights',
          );
        if (r.mix) {
          if (state.play === undefined)
            err(
              d,
              'machine-blend',
              p + '/mix',
              V && 'a blend needs play as its exit clock',
              V && 'set play to the selected child animation',
            );
          const children = r.mix.children.map((c, i) => ({
            timeline: timeline(c.play, `${p}/mix/children/${i}/play`),
            at: c.at ?? 0,
            weight: number(c.weight, `${p}/mix/children/${i}/weight`),
          }));
          Object.assign(info, { children });
          if (
            r.mix.mode === '1d' &&
            (r.mix.axis === undefined ||
              r.mix.children.some(
                (c, i, a) => c.at === undefined || (i > 0 && c.at <= a[i - 1]!.at!),
              ))
          )
            err(
              d,
              'machine-blend',
              p + '/mix',
              V && '1d needs an axis and strictly increasing thresholds',
              V && 'supply axis and a unique increasing at for every child',
            );
          if (
            r.mix.exit !== undefined &&
            (r.mix.exit >= children.length || children[r.mix.exit]?.timeline !== state.play)
          )
            err(
              d,
              'machine-blend',
              p + '/mix/exit',
              V && 'exit child must exist and match play',
              V && 'choose the index whose play matches the state play',
            );
          if (!children.some((c) => c.timeline === state.play))
            err(d, 'machine-blend', p + '/play', V && 'exit clock must be a blend child');
          for (const c of children)
            for (const tr of model.timelines[c.timeline]?.tracks ?? [])
              if (!state.writes.includes(tr.addr)) state.writes.push(tr.addr);
        }
        for (const [i, t] of state.on.entries()) {
          const tr = rawStates[state.name].on[i] as TransitionOptions;
          const tp = p + '/on/' + i;
          transitions.set(t, tr);
          const synced =
            tr.continue &&
            Object.values(rawStates).some((s) =>
              (s as { on?: { to: string; sync?: boolean }[] }).on?.some(
                (edge) => edge.to === state.name && edge.sync,
              ),
            );
          if (tr.continue && (clock.hold || clock.time !== undefined || synced))
            err(
              d,
              'machine-clock',
              tp + '/continue',
              V && 'continued outgoing playback needs an autonomous, unsynchronized source',
              V && 'omit continue or hold/time/sync',
            );
          if (
            (tr as TransitionOptions & { sync?: boolean }).sync &&
            rawStates[layer.states[t.to]!.name].mix
          )
            err(
              d,
              'machine-clock',
              tp + '/sync',
              V && 'blend child clocks cannot inherit a synchronized primary clock',
              V && 'omit sync when entering a blend',
            );
          if (
            ((tr.exitRatio ?? 0) > 0 || (tr.blendRatio ?? 0) > 0) &&
            state.play !== undefined &&
            state.speed * (raw.timelines[model.timelines[state.play]!.name].speed ?? 1) === 0
          )
            err(
              d,
              'machine-clock',
              tp,
              V && 'a positive relative time needs nonzero playback speed',
              V && 'use an explicit duration or a nonzero speed',
            );

          actions(tr.actions, tp + '/actions');
          // Machine owns queued transition actions; core's bind-only form is immediate.
          t.actions = undefined;
          actions(tr.endActions, tp + '/endActions');
          if (rawStates[layer.states[t.to]!.name].kind === 'any')
            err(d, 'machine-state', tp + '/to', V && 'any state is not a transition destination');
          if (tr.change)
            input(
              tr.change.input,
              tr.change.mode === 'changed'
                ? model.inputs.get(tr.change.input)?.type === 'bool'
                  ? 'bool'
                  : 'number'
                : 'number',
              tp + '/change/input',
            );
          for (const [key, operand] of Object.entries(tr.guard ?? {}))
            if (typeof operand === 'object' && operand !== null) {
              if (Object.keys(operand).filter((x) => x !== '$comment').length !== 1)
                err(
                  d,
                  'machine-guard',
                  tp + '/guard/' + key,
                  V && 'choose exactly one operand source',
                );
              if ('component' in operand) {
                const n = String(operand.component),
                  inp = model.inputs.get(n);
                if (!n.includes('.') || !inp || inp.type === 'trigger')
                  err(
                    d,
                    'machine-guard',
                    tp + '/guard/' + key + '/component',
                    V && 'expected a numeric or boolean component input',
                  );
                used.add(n);
              }
              if ('focus' in operand && !model.ids.has(String(operand.focus)))
                err(
                  d,
                  'unknown-target',
                  tp + '/guard/' + key + '/focus',
                  V && 'unknown focus node',
                );
            }
          if (tr.guard) {
            const type = (o: typeof tr.guard.left) =>
              typeof o !== 'object'
                ? typeof o
                : o.focus !== undefined
                  ? 'boolean'
                  : o.component !== undefined
                    ? model.inputs.get(o.component)?.type === 'bool'
                      ? 'boolean'
                      : 'number'
                    : 'number';
            if (
              type(tr.guard.left) !== type(tr.guard.right) ||
              (type(tr.guard.left) === 'boolean' && !['==', '!='].includes(tr.guard.op))
            )
              err(
                d,
                'machine-guard',
                tp + '/guard',
                V && 'guard operand types or operator do not match',
              );
          }
          if (
            (tr.exitRatio !== undefined || tr.blendRatio !== undefined) &&
            state.play === undefined
          )
            err(d, 'machine-clock', tp, V && 'relative times need a play state');
          if (
            tr.blendRatio !== undefined &&
            (tr as TransitionOptions & { blend?: number }).blend !== undefined
          )
            err(d, 'machine-clock', tp + '/blendRatio', V && 'blend and blendRatio are exclusive');
        }
      }
      // Any transitions have priority, but cannot re-enter their own target indefinitely.
      for (const s of any) for (const t of s.on) anyEdges.add(t);
      for (const state of layer.states)
        if (states.get(state)?.kind !== 'any' && states.get(state)?.kind !== 'exit')
          state.on = [
            ...any.flatMap((s) =>
              s.on.filter(
                (t) =>
                  layer.states[t.to] !== state ||
                  t.triggers.length > 0 ||
                  !!transitions.get(t)?.change,
              ),
            ),
            ...state.on,
          ];
    }
    // Any-state edges are real edges; the base loader's pre-extension graph did not see them.
    for (const layer of model.layers) {
      const seen = new Set([layer.initial]);
      const pending = [layer.initial];
      while (pending.length)
        for (const t of layer.states[pending.pop()!]!.on)
          if (!seen.has(t.to)) {
            seen.add(t.to);
            pending.push(t.to);
          }
      for (let i = d.list.length - 1; i >= 0; i--)
        if (
          d.list[i]!.code === 'unreachable-state' &&
          layer.states.some(
            (s, j) =>
              (seen.has(j) || states.get(s)?.kind === 'any') &&
              d.list[i]!.pointer === ptr(ptr('/machine/layers', layer.name) + '/states', s.name),
          )
        )
          d.list.splice(i, 1);
    }
    for (const n of used)
      if (n.includes('.')) {
        const [id, inputName] = n.split('.');
        const node = model.nodes[model.ids.get(id!)!];
        if (node?.raw.component) {
          const pointer = ptr(ptr('/components', node.raw.component) + '/inputs', inputName!);
          for (let i = d.list.length - 1; i >= 0; i--)
            if (d.list[i]!.code === 'unused-input' && d.list[i]!.pointer === pointer)
              d.list.splice(i, 1);
        }
      }
    for (let i = d.list.length - 1; i >= 0; i--)
      if (
        d.list[i]!.code === 'unused-input' &&
        [...used].some((n) => d.list[i]!.pointer === ptr('/inputs', n))
      )
        d.list.splice(i, 1);
    const previous = model.playback;
    model.playback = (p) => new MachinePolicy(p, previous?.(p));
  },
};
