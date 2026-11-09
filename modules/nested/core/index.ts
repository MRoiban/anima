// seam(P8-5): preserve mesh point tuples alongside existing scalar/colour values.
import { nodePointer as pointer } from '../../components/core/node-pointer.ts';
import type { Module } from '../../../packages/core/src/modules.ts';
import type { Model, NodeM, InputEvaluator } from '../../../packages/core/src/load.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { ComponentModule } from '../../components/core/index.ts';
import type { DataModule } from '../../data/core/index.ts';
import type { Diags } from '../../../packages/core/src/diag.ts';
import { same } from '../../data/core/types.ts';
import { formatHex } from '../../../packages/core/src/color.ts';
import { ptr } from '../../../packages/core/src/diag.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { entries } from '../capabilities/components-nested-remap/registry.ts';
import { after } from '../manifest.ts';
import { fit, dynamic, render, dynamicTrees } from './render.ts';
import { clock } from './time.ts';
const outputs = new WeakMap<Model, Map<string, InputEvaluator>>();
const reads = new WeakMap<Model, Set<string>>();
const times = new WeakMap<NodeM, InputEvaluator>();
const points = new WeakMap<NodeM, string>();
const enabled = (m: Model) => m.doc.requires?.includes('nested');
export const nested: Module & { dynamicTrees: typeof dynamicTrees } = {
  name: 'nested',
  after,
  entries,
  dynamicTrees,
  init(registry, shared) {
    const components = registry.get('components') as ComponentModule | undefined;
    const data = registry.get('data') as DataModule | undefined;
    if (!components) return { ...nested, entries: [] };
    const previous = components.externalDrawing;
    components.externalDrawing = (m) => enabled(m) || !!previous?.(m);
    components.selected = (p, n) =>
      !enabled(p.model) ||
      !n.raw.component.startsWith('$') ||
      data?.dataState(p)?.read(n.raw.component) !== '';
    components.choices = (m, n) =>
      enabled(m) && n.raw.component.startsWith('$')
        ? Object.keys(m.doc.components ?? {}).filter((k) => k !== '$comment')
        : undefined;
    components.matrix = (p, child, node) =>
      enabled(p.model) ? fit(node, child.model) : [1, 0, 0, 1, 0, 0];
    components.configure = (parent, child, node) => {
      if (!enabled(parent.model)) return;
      const time = times.get(node);
      if (time || node.raw.fps) clock(parent, child, node, time, points.get(node)!);
    };
    return {
      ...nested,
      prepare(model, d) {
        if (!enabled(model)) return;
        if (!model.doc.requires.includes('components'))
          error(
            d,
            'undeclared-feature',
            '/requires',
            'nested needs components',
            'add components to requires',
          );
      },
      resolve(model, d) {
        if (!enabled(model)) return;
        (model.guardLiterals ??= {}).component = (name, path) =>
          data?.compiled.get(model)?.refs.get(path)?.property.type === 'component' &&
          Object.hasOwn(model.doc.components ?? {}, name) &&
          name !== '$comment'
            ? name
            : undefined;
        const plans = new Map<string, InputEvaluator>();
        outputs.set(model, plans);
        const used = new Set<string>();
        reads.set(model, used);
        const bind = registry.get('bind') as
          typeof import('../../bind/core/index.ts').bind | undefined;
        for (const [name, value] of Object.entries(model.doc.outputs ?? {})) {
          if (name === '$comment') continue;
          const at = ptr('/outputs', name);
          if (!model.doc.requires.includes('bind') || !bind) {
            error(
              d,
              'undeclared-feature',
              at,
              'outputs need bind expressions',
              'add bind to requires',
            );
            continue;
          }
          try {
            const parsed = bind.parse(
              String(value),
              new Map(
                [...model.inputs]
                  .filter(([n]) => !n.startsWith('outputs.'))
                  .map(([n, i]) => [n, i.type]),
              ),
            );
            const run = shared.inputExpression(model, String(value), parsed.type, at, d, (n) =>
              used.add(n),
            );
            if (!run) continue;
            const key = 'outputs.' + name;
            plans.set(key, run);
            model.inputs.set(key, {
              name: key,
              type: parsed.type,
              def:
                parsed.type === 'bool'
                  ? false
                  : parsed.type === 'number'
                    ? 0
                    : parsed.type === 'color'
                      ? [0, 0, 0, 255]
                      : '',
              min: -Infinity,
              max: Infinity,
              buffer: 0,
              readonly: true,
              accepts: (v) =>
                parsed.type === 'color'
                  ? Array.isArray(v)
                  : typeof v === (parsed.type === 'bool' ? 'boolean' : parsed.type),
            });
          } catch (e) {
            error(
              d,
              'output-expression',
              at,
              (e as Error).message,
              'use declared inputs and a scalar expression',
            );
          }
        }
        for (const [i, node] of model.nodes.entries()) {
          if ((node.type as string) === 'repeat') {
            for (const child of new Set(components.placements.get(node)?.values()))
              for (const [name, input] of child.inputs)
                if (name.startsWith('outputs.'))
                  for (let index = 0; index < 256; index++) {
                    const address = node.id + '.' + index + '.' + name,
                      previous = model.inputs.get(address);
                    if (previous && previous.type !== input.type)
                      error(
                        d,
                        'component-input-type',
                        pointer(model, i) + '/component',
                        'mapped outputs have different types',
                        'use consistent output types across mapped components',
                      );
                    model.inputs.set(address, { ...input, name: address });
                  }
            continue;
          }
          if ((node.type as string) !== 'instance') continue;
          const at = pointer(model, i);
          points.set(node, at);
          if ((node.raw.fit || node.raw.align) && !node.raw.size)
            error(
              d,
              'instance-size',
              at + '/size',
              'fit and align need size',
              'set size="width height"',
            );
          if (node.raw.size?.some((n: number) => n <= 0))
            error(
              d,
              'instance-size',
              at + '/size',
              'size must be positive',
              'use positive width and height',
            );
          if (typeof node.raw.time === 'string') {
            const run = shared.inputExpression(
              model,
              node.raw.time,
              'number',
              at + '/time',
              d,
              (n) => used.add(n),
            );
            if (run) times.set(node, run);
          } else if (node.raw.time !== undefined) times.set(node, () => node.raw.time);
          if (node.raw.component.startsWith('$')) {
            const choices = components.placements.get(node);
            for (const child of new Set(choices?.values()))
              for (const [name, input] of child.inputs) {
                const address = node.id + '.' + name;
                const previous = model.inputs.get(address);
                model.inputs.set(address, {
                  ...input,
                  name: address,
                  min: Math.min(previous?.min ?? Infinity, input.min),
                  max: Math.max(previous?.max ?? -Infinity, input.max),
                });
              }
            for (const name of Object.keys(node.raw.inputs ?? {}))
              if ([...new Set(choices?.values())].some((child) => !child.inputs.has(name)))
                error(
                  d,
                  'unknown-input',
                  ptr(at + '/inputs', name),
                  'initializer is absent from a selectable component',
                  'declare the initialized input in every choice',
                );
            const ref = data?.compiled.get(model)?.refs.get(node.raw.component);
            if (ref?.property.type !== 'component')
              error(
                d,
                'component-path',
                at + '/component',
                'instance component needs a component property',
                'declare a component property and use its $path',
              );
            if (!components.placements.get(node)?.size)
              error(
                d,
                'unknown-component',
                at + '/component',
                'dynamic instance needs component definitions',
                'declare at least one component',
              );
          }
        }
        const scan = (value: unknown, at: string): void => {
          if (!value || typeof value !== 'object') return;
          for (const [k, v] of Object.entries(value)) {
            if (k === 'components' || k === 'data') continue;
            const loc = ptr(at, k);
            const targets =
              k === 'set' || k === 'bind' || k === 'pose' || k === 'tracks'
                ? Object.keys(v as object)
                : k === 'toggle' || k === 'fire'
                  ? Array.isArray(v)
                    ? v
                    : [v]
                  : [];
            for (const target of targets)
              if (String(target).includes('.outputs.') || String(target).startsWith('outputs.'))
                error(
                  d,
                  'read-only-path',
                  k === 'set' || k === 'bind' || k === 'pose' || k === 'tracks'
                    ? ptr(loc, String(target))
                    : loc,
                  'component outputs are read-only',
                  'write the child input that supplies the output',
                );
            scan(v, loc);
          }
        };
        scan(model.doc, '');
      },
      load(model, _raw, d) {
        if (!enabled(model)) return;
        for (let i = d.list.length - 1; i >= 0; i--)
          if (
            d.list[i]!.code === 'unused-input' &&
            [...(reads.get(model) ?? [])].some((n) => d.list[i]!.pointer === ptr('/inputs', n))
          )
            d.list.splice(i, 1);
        const inputScope = model.inputScope;
        const plans = outputs.get(model);
        model.inputScope = (p) => {
          const scope = inputScope?.(p) ?? new Map(),
            read = scope.get.bind(scope),
            get = p.get.bind(p),
            values = p.values.bind(p),
            toggle = p.toggle.bind(p);
          if (plans?.size) {
            p.get = (name) =>
              plans.get(name)?.(
                new Map(
                  [...model.inputs.keys()]
                    .filter((key) => !key.startsWith('outputs.'))
                    .map((key) => [key, get(key)!]),
                ),
              ) ?? get(name);
            p.values = () => ({
              ...values(),
              ...Object.fromEntries(
                [...plans.keys()].map((name) => {
                  const v = p.get(name)!;
                  return [
                    name,
                    Array.isArray(v) ? formatHex(v as [number, number, number, number]) : v,
                  ];
                }),
              ),
            });
          }
          p.toggle = (name) => {
            if (name.startsWith('outputs.') || name.includes('.outputs.')) throw readonly(name);
            toggle(name);
          };
          scope.get = (name) =>
            plans?.has(name)
              ? p.get(name)
              : name.includes('.outputs.')
                ? (p.nested?.get(name) ?? read(name))
                : read(name);
          return scope;
        };
        const factory = model.nesting;
        if (!factory) return;
        model.nesting = (p) => {
          const base = factory(
            p,
          ) as import('../../../packages/core/src/player.ts').PlayerExtension & {
            players: Map<string, Player>;
          };
          if (!base) return base;
          if (!model.doc.requires.includes('lists')) dynamic(p, components, data);
          const plans = outputs.get(model);
          if (plans) outputs.set(p.model, plans);
          const names = new Map<string, unknown>();
          const step = base.step.bind(base);
          base.step = (dt) => {
            const before = new Map(
              [...model.inputs]
                .filter(([name, input]) => input.readonly && name.includes('.outputs.'))
                .map(([name]) => [name, p.get(name)]),
            );
            for (const node of model.nodes) {
              if ((node.type as string) !== 'instance' || !node.raw.component.startsWith('$'))
                continue;
              const name = data?.dataState(p)?.read(node.raw.component),
                current = base.players.get(node.id);
              if (names.get(node.id) !== name) {
                names.set(node.id, name);
                p.drawVersions[model.ids.get(node.id)!] = ++p.drawRevision;
              }
              const childModel =
                typeof name === 'string' ? components.placements.get(node)?.get(name) : undefined;
              if (childModel && current?.model.doc !== childModel.doc) {
                const child = new shared.Player(childModel, { reducedMotion: p.reducedMotion });
                components.configure?.(p, child, node);
                model.bindData?.(p, child, node);
                for (const [key, v] of Object.entries(node.raw.inputs ?? {}))
                  if (typeof v !== 'string') child.set(key, v as number | boolean);
                base.players.set(node.id, child);
              } else if (name === '') {
                base.players.delete(node.id);
              } else if (!childModel)
                throw Object.assign(new Error('unknown component ' + String(name)), {
                  code: 'unknown-component',
                  pointer: '/nodes/' + model.nodes.indexOf(node) + '/component',
                  hint: 'write a declared component name',
                });
            }
            const result = step(dt);
            return [...before].some(([name, value]) => !same(p.get(name), value))
              ? { ...result, settled: false }
              : result;
          };
          return base;
        };
      },
      draw: { end: render },
    };
  },
};
export function error(d: Diags, code: string, at: string, message: string, hint: string) {
  d.err(code, at, V && message, V && hint);
}

function readonly(name: string) {
  return Object.assign(new Error('component output is read-only (read-only-path)'), {
    code: 'read-only-path',
    pointer: ptr('/inputs', name),
    hint: 'write the child input that supplies the output',
  });
}
