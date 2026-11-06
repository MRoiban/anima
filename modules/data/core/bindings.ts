import { clone } from './types.ts';
import type { Model, Value } from '../../../packages/core/src/load.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { Diags } from '../../../packages/core/src/diag.ts';
import { ptr } from '../../../packages/core/src/diag.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { resolveAddress } from '../../../packages/core/src/load.ts';
import { parseHex } from '../../../packages/core/src/color.ts';
import { expression, evaluate, BindError } from '../../bind/core/expression.ts';
import { compiled, converters, same, type Binding } from './types.ts';
import { dataState, normalize } from './storage.ts';
interface Link {
  target: string;
  spec: Binding;
  read: (scope: ReadonlyMap<string, Value>, p: Player) => unknown;
  source?: string;
}
export function bindings(
  model: Model,
  d: Diags,
  parse = expression,
  resolve = resolveAddress,
): void {
  if (!model.doc.requires?.includes('data')) return;
  const c = compiled.get(model);
  const types = new Map<string, string>([...model.inputs].map(([n, i]) => [n, i.type]));
  for (const n of model.nodes)
    for (const key of Object.keys(n.raw.properties ?? {})) {
      const a = resolve(n.id + '.properties.' + key, model.nodes, model.ids);
      if (!Array.isArray(a)) {
        types.set(n.id + '.properties.' + key, a.prop.type);
        model.addrs.set(n.id + '.properties.' + key, a);
      }
    }
  const links: Link[] = [];
  const error = (
    code: string,
    p: string,
    m: string,
    h = 'use a writable data path and a target with the same type',
  ) => d.err(code, p, V && m, V && h);
  for (const [target, raw] of Object.entries(model.doc.bind ?? {})) {
    if (
      target === '$comment' ||
      (typeof raw === 'string' && !raw.includes('$') && !raw.includes('.properties.'))
    )
      continue;
    const spec: Binding = typeof raw === 'string' ? { value: raw } : (raw as Binding);
    const at = ptr('/bind', target);
    const a = resolve(target, model.nodes, model.ids);
    if (Array.isArray(a)) {
      error(a[0], at, String(a[1]));
      continue;
    }
    const mode = spec.mode ?? 'to-target';
    const source = c?.refs.has(spec.value) ? spec.value : undefined;
    if (mode === 'to-source' || mode === 'two-way') {
      if (!source || c?.refs.get(source)?.readonly)
        error('data-readonly', at, 'reverse binding needs a writable data path');
    }
    if (spec.prefer && mode !== 'two-way')
      error('data-binding', at + '/prefer', 'prefer is only valid for two-way bindings');
    let read: Link['read'];
    try {
      const whole = /^\$[\w:.-]+$/.test(spec.value) && !source;
      if (whole) read = (_s, p) => dataState(p)?.read(spec.value);
      else {
        const e = parse(spec.value, types);
        if (
          !spec.convert &&
          e.type !== a.prop.type &&
          !(a.prop.type === 'number' && e.type === 'bool')
        )
          throw new BindError('data-type', 0, 'binding type does not match target');
        read = (s) => evaluate(e, s);
      }
      if (
        source &&
        !spec.convert &&
        model.inputs.get(source)?.type !== a.prop.type &&
        !(a.prop.type === 'number' && model.inputs.get(source)?.type === 'bool')
      )
        error('data-type', at, 'binding type does not match target');
      if (spec.convert && !converters.has(spec.convert))
        error(
          'data-converter',
          at + '/convert',
          'unknown converter ' + spec.convert,
          'register the named converter before loading the document',
        );
      model.addrs.set(target, a);
      links.push({ target, spec, read, source });
    } catch (e) {
      if (!(e instanceof Error) || !('code' in e)) throw e;
      error(String(e.code), at, e.message);
    }
  }
  const states = new WeakMap<Player, Map<Link, { source: unknown; raw: Value; output: Value }>>();
  const converterStates = new WeakMap<Player, Map<unknown, unknown>>();
  const previous = model.resolveBindings;
  model.resolveBindings = (p, values, scope, dt) => {
    previous?.(p, values, scope, dt);
    const state = dataState(p);
    const converterState = state?.converterState ?? converterStates.get(p) ?? new Map();
    converterStates.set(p, converterState);
    const last = states.get(p) ?? new Map();
    states.set(p, last);
    // All bindings sample one post-state snapshot; authored order cannot create feedback.
    const snapshot = new Map(scope);
    for (const n of model.inputs.keys()) if (n.startsWith('$')) snapshot.set(n, scope.get(n)!);
    model.addrs.forEach((a, address) => {
      if (address.includes('.properties.'))
        snapshot.set(address, values[p.addrs.indexOf(address)] ?? a.rest);
    });
    const writes: [string, Value][] = [];
    for (const link of links) {
      const { spec, target, source } = link,
        slot = p.addrs.indexOf(target),
        raw = values[slot]!,
        old = last.get(link);
      let value = link.read(snapshot, p);
      const mode = spec.mode ?? 'to-target';
      const options = Object.fromEntries(
        Object.entries(spec.options ?? {}).map(([k, v]) => [
          k,
          typeof v === 'string' && v.startsWith('$') ? state?.read(v) : v,
        ]),
      );
      const convert = (v: unknown, direction: 'forward' | 'reverse'): unknown =>
        spec.convert
          ? converters.get(spec.convert)!(v, options, {
              player: p,
              dt,
              direction,
              get: (path) => state?.read(path),
              state: converterState,
            })
          : v;
      const changedSource = !old || !same(value, old.source),
        changedTarget = !old || !same(raw, old.raw);
      let output = old?.output ?? raw;
      if (
        (mode === 'to-source' && changedTarget) ||
        (mode === 'two-way' && changedTarget && (!changedSource || spec.prefer === 'target'))
      ) {
        if (source) {
          value = normalize(c!.refs.get(source)!.property, convert(raw, 'reverse'));
          writes.push([source, value as Value]);
        }
        output = raw;
      } else if (mode === 'to-target' || !old || (mode === 'two-way' && changedSource)) {
        const v = convert(value, 'forward'),
          prop = model.addrs.get(target)!.prop.type;
        output =
          prop === 'color' && typeof v === 'string'
            ? parseHex(v)!
            : prop === 'number'
              ? Number(v)
              : (v as Value);
      }
      values[slot] = output;
      last.set(link, { source: clone(value), raw, output });
    }
    for (const [path, value] of writes) scope.set(path, value);
    // Gradient channels override the resolved stop colour, irrespective of binding order.
    for (let i = 0; i < p.addrs.length; i++) {
      const m = /^(.*\.stops\.\d+)\.(red|green|blue|alpha)$/.exec(p.addrs[i]!);
      if (!m) continue;
      const index = p.addrs.indexOf(m[1] + '.color');
      if (index >= 0) {
        const color = [...(values[index] as number[])];
        color[['red', 'green', 'blue', 'alpha'].indexOf(m[2]!)] = Number(values[i]);
        values[index] = color as Value;
      }
    }
  };
}
