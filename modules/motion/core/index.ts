import { after } from '../manifest.ts';
import type { Module } from '../../../packages/core/src/modules.ts';
import { type Addr, type Model, type Value, load } from '../../../packages/core/src/load.ts';
import { Player } from '../../../packages/core/src/player.ts';
import { reached, snapTime } from '../../../packages/core/src/time.ts';
import { linear } from '../../../packages/core/src/ease.ts';
import { ptr, Diags } from '../../../packages/core/src/diag.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import type { ObjShape } from '../../../packages/core/src/registry.ts';
import { entries } from './registry.ts';
import { motionEase, valueCurve } from './curves.ts';
import { stateControls, syncs, nextExits } from './control.ts';
import { timing, bounds } from './clock.ts';
import { exits, install, MotionRuntime } from './api.ts';
export * from './api.ts';
let Loader = load,
  PlayerClass = Player;
const error = (d: Diags, code: string, p: string, message: string, hint: string) =>
  d.err(code, p, V && message, V && hint);
function typed(addr: Addr, v: unknown, p: string, d: Diags, model?: Model): Value | undefined {
  const t = addr.prop.type;
  if (t === 'number') return typeof v === 'number' ? v : undefined;
  if (t === 'int' || t === 'uint') {
    const lo = t === 'int' ? -2147483648 : 0,
      hi = t === 'int' ? 2147483647 : 4294967295;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < lo || v > hi)
      return void error(
        d,
        'motion-integer',
        p,
        `expected a 32-bit ${t}`,
        `use an integer in [${lo}, ${hi}]`,
      );
  } else if (t === 'string' || t === 'reference') {
    if (typeof v !== 'string')
      return void error(d, 'value-type', p, 'expected a string', 'use a JSON string');
    if (t === 'reference' && model && !model.ids.has(v))
      return void error(d, 'motion-reference', p, `unknown node ${v}`, 'name an existing node id');
  } else return;
  return v as Value;
}
export const motion: Module = {
  name: 'motion',
  after,
  entries,
  init(_modules, shared) {
    Loader = shared.load;
    PlayerClass = shared.Player;
    install(PlayerClass, shared.sampleTrack, shared.mixValues, shared.resolveAddress);
    return {
      ...motion,
      init: undefined,
      entries: [
        ...entries,
        {
          target: 'document',
          shapes: {
            machines: {
              k: 'map',
              of: (shared.DOC as ObjShape).p.machine!,
              key: /^[a-z][a-zA-Z0-9-]*$/,
              feature: 'motion',
            },
          },
        },
      ],
    };
  },
  model(node, key) {
    if (key === 'pivotX' || key === 'pivotY')
      return {
        prop: { type: 'number', feature: 'motion' },
        rest: node.raw[key] ?? node.raw.pivot?.[key === 'pivotX' ? 0 : 1] ?? 0,
      };
    const m = /^channels\.([a-z][a-zA-Z0-9-]*)$/.exec(key),
      channel = m && node.raw.channels?.[m[1]!];
    if (channel)
      return {
        prop: { type: channel.type, feature: 'motion', discrete: true },
        rest: channel.value,
      };
  },
  value: typed,
  ease(source, p, d) {
    const result = motionEase(source);
    if (result === undefined && !source.startsWith('value-cubic')) return;
    if (!d.features?.includes('motion'))
      error(d, 'undeclared-feature', p, 'ease requires motion', 'add "motion" to "requires"');
    if (typeof result === 'string')
      error(d, 'bad-ease', p, result, 'check the motion ease syntax and argument ranges');
    // A value curve is compiled per numeric segment by track(), never as a shared weight.
    return typeof result === 'function' ? result : linear;
  },
  resolve(model) {
    if (!model.doc.requires?.includes('motion') || !model.doc.requires.includes('data')) return;
    const previous = model.keyValue;
    model.keyValue = (addr, raw, at, d) => {
      if (typeof raw !== 'string' || !raw.startsWith('$')) return previous?.(addr, raw, at, d);
      const input = model.inputs.get(raw),
        kind = addr.prop.type,
        expected = ['int', 'uint'].includes(kind)
          ? 'number'
          : kind === 'reference'
            ? 'string'
            : kind;
      if (!input || input.type !== expected) {
        error(
          d,
          'data-keyframe',
          at,
          'key value needs a compatible scalar data path',
          'declare data and use a $path matching the animated property type',
        );
        return addr.rest;
      }
      return (player) => {
        const value = player.get(raw)!;
        if (
          (input.accepts && !input.accepts(value)) ||
          (['int', 'uint', 'reference'].includes(kind) &&
            typed(addr, value, at, new Diags(), model) === undefined)
        )
          throw Object.assign(new Error('invalid data keyframe value'), {
            code: 'data-keyframe',
            pointer: at,
            hint: 'use a value matching the animated property type',
          });
        return value;
      };
    };
  },
  track(track, addr, keys, p, d) {
    if (!d.features?.includes('motion')) return;
    const kind = addr.prop.type;
    const discrete = ['int', 'uint', 'string', 'reference'].includes(kind);
    const curves = keys.map((k, i) => {
      const src = k[2];
      if (discrete && src !== undefined && src !== 'hold')
        error(
          d,
          'bad-ease',
          `${p}/${i}/2`,
          'typed channels are hold-only',
          'omit the ease or use hold',
        );
      if (typeof src !== 'string' || !src.startsWith('value-cubic')) return;
      if (kind !== 'number') {
        error(
          d,
          'bad-ease',
          `${p}/${i}/2`,
          'value-cubic requires a number',
          'use a numeric property',
        );
        return;
      }
      const curve = valueCurve(
        src,
        track.values[i] as number,
        track.values[Math.min(i + 1, keys.length - 1)] as number,
      );
      if (typeof curve !== 'function') {
        error(
          d,
          'bad-ease',
          `${p}/${i}/2`,
          typeof curve === 'string' ? curve : 'invalid value-cubic',
          'use value-cubic(x1,y1,x2,y2)',
        );
        return;
      }
      return curve;
    });
    if (discrete || curves.some(Boolean))
      track.sample = (time, player) => {
        const read = (i: number): Value => {
          const value = track.values[i]!;
          return typeof value === 'function' ? value(player!) : value;
        };
        let i = 0;
        while (i < track.times.length - 1 && reached(time, track.times[i + 1]!)) i++;
        if (discrete || time <= track.times[0]! || i === track.times.length - 1) return read(i);
        time = snapTime(time, track.times[i]!);
        const u = (time - track.times[i]!) / (track.times[i + 1]! - track.times[i]!);
        if (curves[i]) {
          const dynamic =
            typeof track.values[i] === 'function' || typeof track.values[i + 1] === 'function';
          const curve = dynamic
            ? valueCurve(keys[i]![2] as string, read(i) as number, read(i + 1) as number)
            : curves[i];
          return (curve as (u: number) => number)(u);
        }
        const a = read(i) as number,
          b = read(i + 1) as number;
        return a + (b - a) * track.eases[i]!(u);
      };
  },
  load(model, raw, d) {
    if (!raw.requires?.includes('motion')) return;
    model.timelines.forEach((t) => {
      const r = raw.timelines[t.name],
        p = ptr('/timelines', t.name);
      timing.set(t, { speed: r.speed, quantize: r.quantize, work: r.work });
      if (r.work && !(r.work[0] >= 0 && r.work[0] < r.work[1] && r.work[1] <= t.duration))
        error(
          d,
          'motion-work',
          p + '/work',
          'work area must lie inside the duration',
          'use 0 ≤ start < end ≤ duration',
        );
      for (const tr of t.tracks) {
        const a = model.addrs.get(tr.addr)!;
        if (a.prop.type === 'reference')
          tr.values.forEach(
            (v, i) =>
              typeof v !== 'function' &&
              typed(a, v, ptr(p + '/tracks', tr.addr) + `/${i}/1`, d, model),
          );
      }
    });
    const paths = new Map<unknown, string>();
    const walk = (nodes: unknown[], base: string): void =>
      nodes.forEach((n, i) => {
        const p = base + '/' + i;
        paths.set(n, p);
        const children = (n as { children?: unknown[] }).children;
        if (children) walk(children, p + '/children');
      });
    walk(raw.nodes, '/nodes');
    for (const [i, n] of model.nodes.entries())
      for (const [name, c] of Object.entries(n.raw.channels ?? {}) as [
        string,
        { type: Addr['prop']['type']; value: unknown },
      ][]) {
        typed(
          { node: i, key: 'channels.' + name, prop: { type: c.type }, rest: 0 },
          c.value,
          ptr(paths.get(n.raw)! + '/channels', name) + '/value',
          d,
          model,
        );
      }
    model.layers.forEach((layer) =>
      layer.states.forEach((state) => {
        const sp = ptr(ptr('/machine/layers', layer.name) + '/states', state.name);
        const r = raw.machine.layers[layer.name].states[state.name];
        stateControls.set(state, { hold: r.hold });
        if ((r.hold !== undefined || r.time !== undefined) && state.play === undefined)
          error(
            d,
            'motion-control',
            sp,
            'clock controls need a play state',
            'add play or remove hold/time',
          );
        if (r.hold && r.time !== undefined)
          error(
            d,
            'motion-control',
            sp + '/time',
            'hold and time are exclusive',
            'choose a held or input-controlled clock',
          );
        if (r.time !== undefined && !raw.requires?.includes('bind'))
          error(
            d,
            'undeclared-feature',
            sp + '/time',
            'time expressions require bind',
            'add "bind" to requires',
          );
        for (const [i, tr] of state.on.entries()) {
          const source = r.on[i],
            p = sp + '/on/' + i;
          if (source.sync) {
            if (state.play === undefined || layer.states[tr.to]!.play !== state.play)
              error(
                d,
                'motion-sync',
                p + '/sync',
                'sync needs the same source and target timeline',
                'use play states naming the same timeline',
              );
            else syncs.add(tr);
          }
          if (source.exitNext !== undefined) {
            if (
              state.play === undefined ||
              r.hold ||
              r.time !== undefined ||
              source.exit !== undefined ||
              source.exitFraction !== undefined ||
              tr.terms.some((x) => x.k === 'end' || x.k === 'after') ||
              tr.triggers.length
            )
              error(
                d,
                'motion-exit',
                p + '/exitNext',
                'exitNext needs an autonomous play clock and persistent input condition, without other time gates',
                'use bool/number conditions and a playing source; omit exit/exitFraction',
              );
            else nextExits.set(tr, source.exitNext);
          }
          if (source.ease?.startsWith('value-cubic'))
            error(
              d,
              'bad-ease',
              p + '/ease',
              'a value curve cannot ease a transition',
              'use a weight ease',
            );
          if (source.exit !== undefined && source.exitFraction !== undefined)
            error(
              d,
              'motion-exit',
              p,
              'exit and exitFraction are exclusive',
              'choose one exit unit',
            );
          const threshold =
            source.exit ??
            (source.exitFraction === undefined || state.play === undefined
              ? undefined
              : source.exitFraction *
                (bounds(model.timelines[state.play]!)[1] -
                  bounds(model.timelines[state.play]!)[0]));
          if (source.exit !== undefined || source.exitFraction !== undefined) {
            if (
              state.play === undefined ||
              threshold >
                bounds(model.timelines[state.play]!)[1] - bounds(model.timelines[state.play]!)[0]
            )
              error(
                d,
                'motion-exit',
                p + (source.exit !== undefined ? '/exit' : '/exitFraction'),
                'exit needs a source animation and lies within its work span',
                'use a play state and exit ≤ work duration',
              );
            else exits.set(tr, threshold);
          }
        }
        if (state.pose)
          for (const [a, v] of state.pose)
            if (model.addrs.get(a)!.prop.type === 'reference')
              typed(model.addrs.get(a)!, v, ptr(sp + '/pose', a), d, model);
      }),
    );
    for (const addr of model.addrs.values())
      if (addr.prop.type === 'bool') addr.prop = { ...addr.prop, discrete: true };
    const definitions = new Map<string, Model>();
    for (const [name, machine] of Object.entries(raw.machines ?? {})) {
      if (name === '$comment') continue;
      const doc = { ...raw, machine };
      delete doc.machines;
      // Named machines share the scene and timelines, but own independent inputs and clocks.
      const result = Loader(doc);
      for (const diagnostic of result.diagnostics) {
        if (diagnostic.severity !== 'error') continue;
        const pointer = diagnostic.pointer.startsWith('/machine/')
          ? ptr('/machines', name) + diagnostic.pointer.slice('/machine'.length)
          : diagnostic.pointer;
        if (!d.list.some((d) => d.code === diagnostic.code && d.pointer === pointer))
          d.err(diagnostic.code, pointer, diagnostic.message, diagnostic.hint);
      }
      if (result.model) {
        for (const name of model.inputs.keys()) {
          const pointer = ptr('/inputs', name);
          if (!result.diagnostics.some((d) => d.code === 'unused-input' && d.pointer === pointer)) {
            const i = d.list.findIndex((d) => d.code === 'unused-input' && d.pointer === pointer);
            if (i >= 0) d.list.splice(i, 1);
          }
        }
        definitions.set(name, result.model);
        for (const [a, addr] of result.model.addrs)
          if (!model.addrs.has(a)) model.addrs.set(a, addr);
      }
    }
    model.playback = (p) => new MotionRuntime(p, definitions, PlayerClass);
  },
};
