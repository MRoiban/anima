import type { Module } from '../../../packages/core/src/modules.ts';
import type { Shape, ObjShape } from '../../../packages/core/src/registry.ts';
import { resolveAddress } from '../../../packages/core/src/load.ts';
import { NAME } from '../../../packages/core/src/registry.ts';
import { ptr } from '../../../packages/core/src/diag.ts';
import { after } from '../manifest.ts';

export interface EventDefinition {
  payload?: Record<
    string,
    {
      type: 'number' | 'bool' | 'string';
      value?: number | boolean | string;
      input?: string;
      address?: string;
    }
  >;
  url?: string;
  target?: '_blank' | '_parent' | '_self' | '_top';
  audio?: string;
  volume?: number;
}
const str = (): Shape => ({ k: 'str' });
const field: ObjShape = {
  k: 'obj',
  p: {
    type: { k: 'str', of: ['number', 'bool', 'string'] },
    value: { k: 'any' },
    input: str(),
    address: str(),
  },
  req: ['type'],
};
export const definition: ObjShape = {
  k: 'obj',
  p: {
    payload: { k: 'map', of: field, key: NAME },
    url: str(),
    target: { k: 'str', of: ['_blank', '_parent', '_self', '_top'] },
    audio: str(),
    volume: { k: 'num', min: 0, max: 1 },
  },
};
let resolve = resolveAddress;
export const events: Module = {
  init(_modules, shared) {
    resolve = shared.resolveAddress;
    const listeners = (shared.DOC as ObjShape).p.listeners as Extract<Shape, { k: 'arr' }>;
    const listener = listeners.of as ObjShape;
    const previous = listener.p.on as Extract<Shape, { k: 'str' }>;
    (shared.DOC as ObjShape).p.listeners = {
      ...listeners,
      of: {
        ...listener,
        p: {
          ...listener.p,
          on: {
            k: 'str',
            re: new RegExp(
              '(?:' +
                (previous.re?.source ?? '^(' + previous.of!.join('|') + ')$') +
                '|^event:[a-z][a-zA-Z0-9-]*$)',
            ),
          },
        },
      },
    };
    return { ...events, init: undefined };
  },
  name: 'events',
  after,
  entries: [
    { target: 'state', shapes: { endEmit: { k: 'str', re: NAME } } },
    {
      target: 'transition',
      shapes: { startEmit: { k: 'str', re: NAME }, endEmit: { k: 'str', re: NAME } },
    },
    {
      target: 'document',
      elements: {
        'event-def': {
          shape: {
            k: 'obj',
            p: { name: { k: 'str', re: NAME }, ...definition.p, payload: { k: 'str' } },
            req: ['name'],
          },
        },
        'audio-volume': {
          shape: {
            k: 'obj',
            p: { asset: { k: 'str', re: NAME }, value: { k: 'num', min: 0, max: 1 } },
            req: ['asset', 'value'],
          },
        },
      },
      shapes: {
        eventDefs: { k: 'map', of: definition, key: NAME },
        audioVolumes: { k: 'map', of: { k: 'num', min: 0, max: 1 }, key: NAME },
      },
    },
  ],
  load(model, raw, d) {
    if (!raw.requires?.includes('events')) {
      for (const [i, l] of model.listeners.entries())
        if (l.on.startsWith('event:'))
          d.err(
            'undeclared-feature',
            '/listeners/' + i + '/on',
            'event listeners require events',
            'add events to requires',
          );
      return;
    }
    const defs = Object.fromEntries(
      Object.entries(raw.eventDefs ?? {}).filter(([k]) => k !== '$comment'),
    ) as Record<string, EventDefinition>;
    for (const [name, def] of Object.entries(defs)) {
      if (name === '$comment') continue;
      const p = ptr('/eventDefs', name);
      if (def.target && !def.url)
        d.err('event-url', p + '/target', 'target requires a URL', 'add url or remove target');
      if (def.url) {
        if (/^[^/?#]*:/.test(def.url) && !/^https?:\/\//i.test(def.url))
          d.err(
            'event-url',
            p + '/url',
            'event URL must resolve to HTTP(S)',
            'use an http(s) URL or relative path',
          );
      }
      if (def.audio && raw.assets?.[def.audio]?.type !== 'audio')
        d.err(
          'event-audio',
          p + '/audio',
          'unknown audio asset',
          'declare an audio asset with this name',
        );
      for (const [key, f] of Object.entries(def.payload ?? {}).filter(([k]) => k !== '$comment')) {
        const fp = ptr(p + '/payload', key);
        const type = f.type === 'bool' ? 'boolean' : f.type;
        if (
          [f.input, f.value, f.address].filter((v) => v !== undefined).length !== 1 ||
          (f.value !== undefined &&
            (typeof f.value !== type || (f.type === 'number' && !Number.isFinite(f.value))))
        )
          d.err(
            'event-payload',
            fp,
            'payload needs exactly one correctly typed value or input',
            'provide value or input matching type',
          );
        if (f.address !== undefined) {
          const addr = resolve(f.address, model.nodes, model.ids);
          if (Array.isArray(addr) || addr.prop.type !== f.type)
            d.err(
              'event-address',
              fp + '/address',
              'payload address is missing or has a different type',
              'reference a tracked property matching type',
            );
          else model.addrs.set(f.address, addr);
        }
        if (f.input !== undefined && model.inputs.get(f.input)?.type !== f.type)
          d.err(
            'event-input',
            fp + '/input',
            'payload input is missing or has a different type',
            'reference a bool or number input matching type',
          );
      }
    }
    const readInputs = new Set(
      Object.values(defs).flatMap((def) =>
        Object.entries(def.payload ?? {})
          .filter(([k]) => k !== '$comment')
          .map(([, v]) => v)
          .flatMap((f) => (f.input ? [f.input] : [])),
      ),
    );
    for (let i = d.list.length - 1; i >= 0; i--)
      if (
        d.list[i]!.code === 'unused-input' &&
        [...readInputs].some((n) => d.list[i]!.pointer === ptr('/inputs', n))
      )
        d.list.splice(i, 1);
    for (const name of Object.keys(raw.audioVolumes ?? {}).filter((k) => k !== '$comment'))
      if (raw.assets?.[name]?.type !== 'audio')
        d.err(
          'event-audio',
          ptr('/audioVolumes', name),
          'unknown audio asset',
          'declare an audio asset with this name',
        );
    const actions = new WeakMap<
      import('../../../packages/core/src/load.ts').TransitionM,
      { startEmit?: string; endEmit?: string }
    >();
    const actionNames: string[] = [];
    for (const layer of model.layers)
      for (const state of layer.states) {
        const rawState = raw.machine.layers[layer.name].states[state.name];
        if (rawState.endEmit) actionNames.push(rawState.endEmit);
        state.on.forEach((tr, i) => {
          const r = rawState.on[i];
          actions.set(tr, r);
          if (r.startEmit) actionNames.push(r.startEmit);
          if (r.endEmit) actionNames.push(r.endEmit);
        });
      }
    const active = new WeakMap<
      import('../../../packages/core/src/player.ts').Player,
      Map<string, import('../../../packages/core/src/load.ts').TransitionM>
    >();
    const names = new Set([
      ...Object.keys(defs),
      ...actionNames,
      ...model.timelines.flatMap((t) => t.events.map((e) => e[1])),
      ...model.layers.flatMap((l) => l.states.flatMap((s) => (s.emit ? [s.emit] : []))),
      ...model.listeners.flatMap((l) => (l.emit ? [l.emit] : [])),
    ]);
    model.eventNames = names;
    for (const [i, l] of model.listeners.entries())
      if (l.on.startsWith('event:') && !names.has(l.on.slice(6)))
        d.err(
          'unknown-event',
          '/listeners/' + i + '/on',
          'unknown event listener name',
          'reference an emitted event name',
        );
    model.eventSignal = (out, kind, layer, state, player, transition) => {
      out.push({ name: '@' + kind, layer, time: 0, payload: { state } });
      let name: string | undefined;
      if (kind === 'state-end') name = raw.machine.layers[layer].states[state].endEmit;
      else {
        let running = active.get(player);
        if (!running) active.set(player, (running = new Map()));
        if (kind === 'transition-start' && transition) running.set(layer, transition);
        const tr = transition ?? running.get(layer);
        name = tr
          ? actions.get(tr)?.[kind === 'transition-start' ? 'startEmit' : 'endEmit']
          : undefined;
        if (kind === 'transition-end') running.delete(layer);
      }
      if (name) out.push({ name, layer, time: 0 });
    };
    model.timelineMarkers = (tl) => {
      if (tl.loop === 'once') return;
      const work = raw.timelines[tl.name].work ?? [0, tl.duration];
      return tl.loop === 'pingpong'
        ? [
            [work[0], '@loop'],
            [work[1], '@loop'],
          ]
        : [[work[1], '@loop']];
    };
    model.reportEvents = (player, out) => {
      for (const e of out) {
        const def = defs[e.name];
        for (const listener of model.listeners)
          if (listener.on === 'event:' + e.name) player.act(listener);
        if (!def) continue;
        if (def.payload)
          e.payload = Object.fromEntries(
            Object.entries(def.payload)
              .filter(([k]) => k !== '$comment')
              .map(([k, f]) => [
                k,
                f.address !== undefined
                  ? (player.value(f.address) as number | boolean | string)
                  : f.input === undefined
                    ? f.value!
                    : player.get(f.input)!,
              ]),
          );
        if (def.url) {
          e.url = def.url;
          e.target = def.target ?? '_self';
        }
        if (def.audio) {
          e.audio = def.audio;
          e.volume = def.volume ?? 1;
        }
      }
    };
  },
};
