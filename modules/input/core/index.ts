import { registerEventKinds } from '../../components/core/events.ts';
import { after } from '../manifest.ts';
import type { Module } from '../../../packages/core/src/modules.ts';
import type { Model } from '../../../packages/core/src/load.ts';
import type { ObjShape, Shape } from '../../../packages/core/src/registry.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { extendListener, nodeShapes, soloShape } from './registry.ts';
import { install, configurations } from './runtime.ts';
import { events, fields, type InputListener } from './types.ts';
import { listenerValue } from './values.ts';
export * from './runtime.ts';
export * from './types.ts';
export const input: Module & { listenerValue: typeof listenerValue } = {
  listenerValue,
  name: 'input',
  after,
  draw: {
    tree(model, tree) {
      for (let i = 0; i < model.nodes.length; i++) {
        const deps = new Set(tree.nodes[i]!.dependencies ?? [i]);
        for (let n = model.nodes[i]!.parent; n >= 0; n = model.nodes[n]!.parent) deps.add(n);
        tree.nodes[i]!.dependencies = [...deps];
      }
    },
    frame(player, node, data) {
      data.visible = player.visible(node);
    },
  },
  entries: [
    {
      target: 'node',
      shapes: nodeShapes,
      props: {
        pointerEnabled: { type: 'bool', def: true },
        collapsed: { type: 'bool', def: false },
      },
    },
    { target: 'group', shapes: { solo: soloShape }, props: { solo: { type: 'number', def: -1 } } },
  ],
  init(_modules, shared) {
    install(shared.Player);
    registerEventKinds(_modules, 'input', events);
    const listeners = (shared.DOC as ObjShape).p.listeners as Extract<Shape, { k: 'arr' }>;
    return {
      ...input,
      init: undefined,
      entries: [
        ...input.entries,
        {
          target: 'document',
          shapes: {
            listeners: { ...listeners, feature: '', of: extendListener(listeners.of as ObjShape) },
          },
        },
      ],
    };
  },

  resolve(model) {
    if (!model.doc.requires?.includes('input')) return;
    for (const r of model.doc.listeners ?? []) {
      if (typeof r.write === 'string') {
        r.write = { [r.value ?? '']: r.write };
        delete r.value;
      }
      if (r.write && !['set', 'fire', 'toggle', 'emit'].some((key) => key in r)) r.set = {};
    }
  },
  load(model, raw, diag) {
    const enabled = raw.requires?.includes('input');
    const result: InputListener[] = [];
    const error = (code: string, p: string, m: string, h: string) =>
      diag.err(code, p, V && m, V && h);
    for (const [i, r] of (raw.listeners ?? []).entries()) {
      const on = r.on.split('|') as string[];
      if (!enabled) {
        if (
          on.length > 1 ||
          on.some(
            (x) =>
              events.includes(x as (typeof events)[number]) &&
              !['enter', 'leave', 'move', 'down', 'up', 'click'].includes(x),
          )
        )
          error(
            'undeclared-feature',
            `/listeners/${i}/on`,
            'extended listeners require input',
            'add "input" to requires',
          );
        continue;
      }
      const p = `/listeners/${i}`;
      for (const key of ['button', 'index', 'control'])
        if (r[key] !== undefined && !Number.isInteger(r[key]))
          error(
            'input-index',
            p + '/' + key,
            'indices must be whole numbers',
            'use a nonnegative integer',
          );
      if (r.button !== undefined && r.button > 2)
        error(
          'input-index',
          p + '/button',
          'unsupported pointer button',
          'use 0 (primary), 1 (middle), or 2 (secondary)',
        );
      if (
        r.modifiers !== undefined &&
        !/^(?:shift\+)?(?:control\+)?(?:alt\+)?(?:meta\+)?$/.test(
          r.modifiers ? r.modifiers + '+' : '',
        )
      )
        error(
          'input-modifiers',
          p + '/modifiers',
          'invalid exact modifier set',
          'use shift+control+alt+meta in that order, omitting unheld keys',
        );
      for (const [field, name] of Object.entries(r.write ?? {}) as [string, string][]) {
        if (!fields.includes(field as (typeof fields)[number]))
          error(
            'input-write',
            p + '/write/' + field,
            'unknown event value',
            'use a documented input event field (pointer coordinates need number; key-pressed needs string)',
          );
        const input = model.inputs.get(name),
          type = field === 'key-pressed' ? 'string' : field === 'pressed' ? 'bool' : 'number';
        if (!input || input.type !== type || input.readonly)
          error(
            'input-write',
            p + '/write/' + field,
            `event value needs a ${type} input`,
            `declare ${name} as ${type}`,
          );
      }
      const action = model.listeners[i]!;
      let depth = 0;
      for (let n = action.target; n >= 0; n = model.nodes[n]!.parent) depth++;
      result.push({ ...r, on, action, target: action.target, order: i, depth });
    }
    if (enabled) {
      configurations.set(model, result);
      const written = new Set(result.flatMap((l) => Object.values(l.write ?? {})));
      for (let i = diag.list.length - 1; i >= 0; i--)
        if (
          diag.list[i]!.code === 'unused-input' &&
          written.has(diag.list[i]!.pointer.slice('/inputs/'.length))
        )
          diag.list.splice(i, 1);
    }
    // Solo selections are direct-child indices, never an implicit node search.
    const walk = (nodes: Model['doc']['nodes'], base: string) =>
      nodes.forEach((n: Model['doc'], i: number) => {
        if (
          n.solo !== undefined &&
          (!Number.isInteger(n.solo) || n.solo >= (n.children?.length ?? 0))
        )
          error(
            'input-solo',
            `${base}/${i}/solo`,
            'solo index is outside direct children',
            'use -1 for no selected child or an existing zero-based child index',
          );
        if (n.children) walk(n.children, `${base}/${i}/children`);
      });
    if (enabled) walk(raw.nodes, '/nodes');
  },
};
