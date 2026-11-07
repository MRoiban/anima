// Tooling-only instrumentation: no hook or byte is added to data/host runtime bundles.
import type { Player } from './player.ts';
import type { ActionM, ListenerM, Model } from './load.ts';
import { compiledActions } from '../../../modules/machine/core/types.ts';
import { dataState } from '../../../modules/data/core/storage.ts';

export interface DataWrite {
  path: string;
  before: unknown;
  value: unknown;
  writer: string;
}
/** Install on an isolated replay player only. Restore shared compiled action arrays afterwards. */
export function traceWrites(player: Player, emit: (write: DataWrite) => void) {
  let writer = 'runtime input';
  const undo: (() => void)[] = [];
  const scope = dataState(player);
  if (!scope) return { run: (_label: string, op: () => void) => op(), close() {} };
  const mark = (label: string): ListenerM => {
    const set: ActionM['set'] = [];
    set.map = ((...args: Parameters<typeof set.map>) => {
      writer = label;
      return Array.prototype.map.apply(set, args);
    }) as typeof set.map;
    return { set, fire: [], toggle: [], on: '', target: -1, pad: 0 };
  };
  const originalAct = player.act.bind(player);
  player.act = (action) => {
    const i = player.model.listeners.indexOf(action);
    originalAct(mark(i < 0 ? writer : 'listener: /listeners/' + i));
    originalAct(action);
  };
  const set = player.set.bind(player),
    toggle = player.toggle.bind(player);
  player.set = (name, value) => {
    originalAct(mark(writer));
    set(name, value);
  };
  player.toggle = (name) => {
    originalAct(mark(writer));
    toggle(name);
  };
  // Host writes apply closures directly to instance objects, bypassing DataState.set.
  const api = player.data;
  const enqueue = api.enqueue.bind(api);
  api.enqueue = (op) => {
    const label = writer;
    enqueue(() => {
      writer = label;
      op();
    });
  };
  const seen = new WeakSet<object>();
  const observe = (object: Record<string, unknown>, path: string) => {
    if (seen.has(object)) return;
    seen.add(object);
    for (const key of Object.keys(object)) {
      let value = object[key];
      const at = path + (path.endsWith(':') ? '' : '.') + key;
      if (value && typeof value === 'object') observe(value as Record<string, unknown>, at);
      Object.defineProperty(object, key, {
        configurable: true,
        enumerable: true,
        get: () => value,
        set: (next) => {
          const stack = new Error().stack ?? '';
          const source = stack.includes('/data/core/bindings.ts')
            ? 'binding: ' +
              stack
                .split('\n')
                .find((line) => line.includes('/data/core/bindings.ts'))
                ?.trim()
            : writer;
          emit({ path: at, before: value, value: next, writer: source });
          value = next;
          if (next && typeof next === 'object') observe(next as Record<string, unknown>, at);
        },
      });
    }
  };
  for (const [name, values] of Object.entries(scope.instances)) observe(values, '$' + name + ':');
  const actions = (action: ActionM | undefined, label: string) => {
    if (!action) return;
    const set = action.set;
    const map = set.map;
    set.map = ((...args: Parameters<typeof set.map>) => {
      writer = label;
      return map.apply(set, args);
    }) as typeof set.map;
    undo.push(() => {
      set.map = map;
    });
  };
  const model: Model = player.model;
  for (const layer of model.layers)
    for (const state of layer.states) {
      const at = '/machine/layers/' + layer.name + '/states/' + state.name;
      actions(state.entry, 'state action: ' + at + '/entry');
      actions(state.exit, 'state action: ' + at + '/exit');
      state.on.forEach((t, i) => actions(t.actions, 'transition action: ' + at + '/on/' + i));
    }
  const visit = (value: unknown, pointer: string): void => {
    if (!value || typeof value !== 'object') return;
    const action = compiledActions.get(
      value as import('../../../modules/machine/core/types.ts').Actions,
    );
    if (action) actions(action, 'machine action: ' + pointer);
    for (const [key, child] of Object.entries(value))
      visit(child, pointer + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1'));
  };
  visit(model.doc.machine, '/machine');
  return {
    run(label: string, op: () => void) {
      writer = label;
      op();
    },
    close() {
      for (const restore of undo.reverse()) restore();
    },
  };
}
