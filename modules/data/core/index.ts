import { dataCodes } from './errors.ts';
import { resolveAddress } from '../../../packages/core/src/load.ts';
import { clone } from './types.ts';
import type { Module } from '../../../packages/core/src/modules.ts';
import type { Shape, ObjShape } from '../../../packages/core/src/registry.ts';
import { parseHex } from '../../../packages/core/src/color.ts';
import { after } from '../manifest.ts';
import { prepare } from './compile.ts';
import { custom } from './custom.ts';
import { bindings } from './bindings.ts';
import { binding, dataShape } from './registry.ts';
import { compiled, converters, registerConverter, same } from './types.ts';
import { dataState, type DataState } from './storage.ts';
import { registerEventKinds } from '../../components/core/events.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
export { dataCodes } from './errors.ts';
export { dataState } from './storage.ts';
export { converters, registerConverter, type Converter, type Context } from './types.ts';
export { systemEnums } from './enums.ts';
let listenerValue: typeof import('../../input/core/values.ts').listenerValue | undefined;
let resolve = resolveAddress;
let parse: typeof import('../../bind/core/expression.ts').expression | undefined;
const path = /^(?:\$[a-zA-Z][\w-]*(?::[a-zA-Z][\w-]*)?(?:\.[\w-]+)*|[a-z][\w-]*(?:\.[\w-]+)*)$/;
export type DataModule = Module & {
  // seam(P7-5): rewrites data's private document copy before compilation (data-artboard).
  normalize?: (
    document: import('./types.ts').DataDocument,
    model: import('../../../packages/core/src/load.ts').Model,
  ) => void;
  prepareContext?: (
    model: import('../../../packages/core/src/load.ts').Model,
    diag: import('../../../packages/core/src/diag.ts').Diags,
  ) => void;
  dataState: typeof dataState;
  dataCodes: typeof dataCodes;
  compiled: typeof compiled;
  converters: typeof converters;
  registerConverter: typeof registerConverter;
};
export const data: DataModule = {
  name: 'data',
  compiled,
  dataCodes,
  after,
  converters,
  dataState,
  registerConverter,
  prepare(model, d) {
    custom(model, d);
    prepare(model, d, (this as DataModule).prepareContext, (this as DataModule).normalize);
  },
  init(registry, shared) {
    listenerValue = (
      registry.get('input') as typeof import('../../input/core/index.ts').input | undefined
    )?.listenerValue;
    resolve = shared.resolveAddress;
    parse = (registry.get('bind') as typeof import('../../bind/core/index.ts').bind | undefined)
      ?.parse;
    registerEventKinds(registry, 'data', ['change:']);
    const listeners = (shared.DOC as ObjShape).p.listeners as Extract<Shape, { k: 'arr' }>;
    const listener = listeners.of as ObjShape;
    const old = listener.p.on as Extract<Shape, { k: 'str' }>;
    const actions = (shape: ObjShape) => {
      for (const key of ['fire', 'toggle'])
        shape.p[key] = {
          k: 'alt',
          of: [
            { k: 'str', re: path },
            { k: 'arr', of: { k: 'str', re: path }, min: 1 },
          ],
        };
      shape.p.set = { k: 'map', key: path, of: (shape.p.set as Extract<Shape, { k: 'map' }>).of };
    };
    actions(listener);
    const layers = ((shared.DOC as ObjShape).p.machine as ObjShape).p.layers as Extract<
      Shape,
      { k: 'map' }
    >;
    const state = ((layers.of as ObjShape).p.states as Extract<Shape, { k: 'map' }>).of as ObjShape;
    for (const key of ['entry', 'exit', 'enterActions', 'exitActions'])
      if (state.p[key]?.k === 'obj') actions(state.p[key] as ObjShape);
    const transition = (state.p.on as Extract<Shape, { k: 'arr' }>).of as ObjShape;
    for (const key of ['actions', 'endActions'])
      if (transition.p[key]?.k === 'obj') actions(transition.p[key] as ObjShape);
    return {
      ...data,
      init: undefined,
      entries: [
        ...data.entries,
        ...(registry.has('components')
          ? [{ target: 'instance', shapes: { data: { k: 'str' as const } } }]
          : []),
        {
          target: 'document',
          shapes: {
            listeners: {
              ...listeners,
              feature: '',
              of: {
                ...listener,
                p: {
                  ...listener.p,
                  on: {
                    k: 'str',
                    re: new RegExp('(?:' + old.re?.source + ')|^change:\\$[\\w:.-]+$'),
                  },
                  copy: { k: 'str', feature: 'data' },
                  value: { k: 'str', feature: 'data' },
                },
              },
            },
          },
        },
      ],
    };
  },
  entries: [
    {
      target: 'document',
      shapes: {
        data: { ...dataShape },
        bind: { k: 'map', of: { k: 'alt', of: [{ k: 'str' }, binding] }, feature: 'bind|data' },
      },
    },
    { target: 'node', shapes: { properties: { k: 'map', of: { k: 'any' } } } },
  ],
  model(node, key) {
    const m = /^properties\.([\w-]+)$/.exec(key);
    if (m && Object.hasOwn(node.raw.properties ?? {}, m[1]!)) {
      const raw = node.raw.properties[m[1]!];
      const prop =
        typeof raw === 'object' && raw !== null
          ? raw
          : {
              type:
                typeof raw === 'boolean' ? 'bool' : typeof raw === 'number' ? 'number' : 'string',
              default: raw,
            };
      if (prop.type === 'trigger') return;
      const rest =
        prop.type === 'color'
          ? parseHex(prop.default ?? '#000')!
          : (prop.default ??
            (prop.type === 'number' ? 0 : prop.type === 'bool' ? false : (prop.values?.[0] ?? '')));
      return {
        prop: {
          type: prop.type === 'enum' ? 'string' : prop.type,
          feature: 'data',
          discrete: !['number', 'color'].includes(prop.type),
        },
        rest,
      };
    }
    const channel = /^(fill|stroke)\.stops\.(\d+)\.(red|green|blue|alpha)$/.exec(key);
    if (channel) {
      const color = parseHex(node.raw[channel[1]!]?.stops?.[+channel[2]!]?.color ?? '');
      if (color)
        return {
          prop: { type: 'number', min: 0, max: 255, feature: 'data' },
          rest: color[['red', 'green', 'blue', 'alpha'].indexOf(channel[3]!)]!,
        };
    }
  },
  value(addr, value, pointer, d) {
    if (addr.prop.type === 'string' && typeof value === 'string') return value;
    d.err(
      dataCodes['type'],
      pointer,
      V && 'custom property value has the wrong type',
      V && 'use the declared custom property type',
    );
  },
  load(model, raw, d) {
    if (!raw.requires?.includes('data')) return;
    bindings(model, d, parse, resolve);
    for (const [address] of [...model.addrs])
      if (/\.stops\.\d+\.(red|green|blue|alpha)$/.test(address)) {
        const color = address.replace(/\.(red|green|blue|alpha)$/, '.color');
        const a = resolve(color, model.nodes, model.ids);
        if (!Array.isArray(a)) model.addrs.set(color, a);
      }
    const c = compiled.get(model);
    if (!c) return;
    for (const [i, l] of model.listeners.entries()) {
      const r = raw.listeners[i],
        at = '/listeners/' + i;
      if (r.copy) {
        const m = /^(\$[\w:.-]+)\s*->\s*(\$[\w:.-]+)$/.exec(r.copy);
        if (!m)
          d.err(
            dataCodes['copy'],
            at + '/copy',
            V && 'copy needs $source -> $destination',
            V && 'use two declared paths',
          );
        else {
          const a = c.refs.get(m[1]!),
            b = c.refs.get(m[2]!);
          if (!a || !b || a.input.type !== b.input.type)
            d.err(
              dataCodes['type'],
              at + '/copy',
              V && 'copy path types must match',
              V && 'choose paths with the same type',
            );
          else if (b.readonly)
            d.err(
              dataCodes['readonly'],
              at + '/copy',
              V && 'copy destination is read-only',
              V && 'write an item property',
            );
          else l.set.push([m[2]!, (scope) => scope.get(m[1]!)!]);
        }
      }
      if (r.value) {
        const m = /^gamepad-(axis|button-pressed|button-value|changed-value)(?::(\d+))?$/.exec(
          r.value,
        );
        const focus = r.value === 'focused';
        if (!focus && !m)
          d.err(
            dataCodes['value-source'],
            at + '/value',
            V && 'unknown listener value source',
            V && 'use focused or a gamepad value source',
          );
        if ((focus && !raw.requires.includes('focus')) || (m && !raw.requires.includes('input')))
          d.err(
            dataCodes['value-source'],
            at + '/value',
            V && 'value source requires its owning module',
            V && 'add focus or input to requires',
          );
        const bool = focus || m?.[1] === 'button-pressed';
        for (const [name] of l.set)
          if (model.inputs.get(name)?.type !== (bool ? 'bool' : 'number'))
            d.err(
              dataCodes['type'],
              at + '/value',
              V && 'value source and destination types differ',
              V && 'use a destination with the source type',
            );
        l.set = l.set.map(([name]) => [
          name,
          (scope) => {
            const p = (scope as DataState).player!;
            if (focus) return p.machineFocus?.(model.nodes[l.target]?.id ?? '') ?? false;
            return listenerValue?.(p, r) ?? 0;
          },
        ]);
      }
      if (l.on.startsWith('change:') && !c.refs.has(l.on.slice(7)))
        d.err(
          dataCodes['path'],
          at + '/on',
          V && 'unknown change listener path',
          V && 'use change:$property',
        );
    }
    const watched = new Set(
      model.listeners.filter((l) => l.on.startsWith('change:')).map((l) => l.on.slice(7)),
    );
    if (!watched.size) return;
    const previous = model.afterStep;
    const last = new WeakMap<object, Map<string, unknown>>();
    model.afterStep = (p) => {
      previous?.(p);
      const state = dataState(p)!;
      const before =
        last.get(p) ??
        new Map(
          [...watched].map((path) => {
            const r = c.refs.get(path)!;
            return [
              path,
              r.input.type === 'trigger'
                ? 0
                : (state.initial?.get(path) ?? readDefault(c.defaults, r)),
            ];
          }),
        );
      const now = new Map(
        [...watched].map((path) => {
          const r = c.refs.get(path)!;
          return [
            path,
            r.input.type === 'trigger'
              ? (state.signals.get(r.input.name) ?? 0)
              : clone(state.get(path)),
          ];
        }),
      );
      for (const l of model.listeners)
        if (l.on.startsWith('change:')) {
          const path = l.on.slice(7);
          if (!same(before.get(path), now.get(path))) p.act(l);
        }
      last.set(p, now);
    };
  },
};
function readDefault(
  defaults: Record<string, Record<string, unknown>>,
  ref: import('./types.ts').Ref,
): unknown {
  let value: unknown = defaults[ref.instance];
  for (const k of ref.keys)
    value = value == null ? undefined : (value as Record<string, unknown>)[k];
  return value;
}
