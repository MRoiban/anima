import type { Module } from '../../../packages/core/src/modules.ts';
import type { NodeM, Model } from '../../../packages/core/src/load.ts';
import type { Diags } from '../../../packages/core/src/diag.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import { drawFrame } from '../../../packages/core/src/draw.ts';
import { mul } from '../../../packages/core/src/geom.ts';
import { flatten, parsePath } from '../../../packages/core/src/path.ts';
import { nodePointer } from '../../components/core/node-pointer.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import type { ObjShape } from '../../../packages/core/src/registry.ts';
import { entries, axes } from './registry.ts';
import { arrange, edges, weight, clamp, type Box, type Size, type Item } from './algorithm.ts';
import { after } from '../manifest.ts';
import { measureText, textSizing } from '../../text/core/index.ts';
import type { TextModule, TextDrawNode } from '../../text/core/index.ts';
import { reflow, validateReflow } from './reflow.ts';
export type { Box } from './algorithm.ts';
let geometryModules: ReadonlyMap<string, Module> = new Map();
const states = new WeakMap<
  Player,
  {
    boxes: Map<number, Box>;
    drawn: Map<number, Box>;
    signatures: Map<number, string>;
    measured: Map<number, { width: number; height: number; baseline: number }>;
  }
>();
let text: TextModule | undefined;
export interface LayoutModule extends Module {
  reflow?: typeof reflow;
  validateReflow?: typeof validateReflow;
}
const drawn = (p: Player, i: number) => states.get(p)?.drawn.get(i);
export function layoutBox(p: Player, id: string, visual?: boolean): Box | undefined {
  const i = p.model.ids.get(id),
    box = i === undefined ? undefined : states.get(p)?.[visual ? 'drawn' : 'boxes'].get(i);
  return box && { ...box };
}
declare module '../../../packages/core/src/player.ts' {
  interface Player {
    layoutBox(id: string): Box | undefined;
    drawnLayoutBox(id: string): Box | undefined;
    layoutSize?: Size;
  }
}
function configuration(p: Player, i: number) {
  const n = p.model.nodes[i]!,
    container = (n.type as string) === 'layout';
  const read = (key: string) => p.prop(i, (container ? '' : 'layout.') + key);
  return {
    mode: axes.map((a) => p.prop(i, 'layout.' + a) ?? read(a)),
    min: axes.map((a) =>
      Number(
        p.prop(i, 'layout.min' + a[0]!.toUpperCase() + a.slice(1)) ??
          read('min' + a[0]!.toUpperCase() + a.slice(1)) ??
          0,
      ),
    ) as Size,
    max: axes.map((a) =>
      Number(
        p.prop(i, 'layout.max' + a[0]!.toUpperCase() + a.slice(1)) ??
          read('max' + a[0]!.toUpperCase() + a.slice(1)) ??
          Infinity,
      ),
    ) as Size,
    margin: edges(p.prop(i, 'layout.margin')).map((v, j) => p.num(i, 'layout.margin.' + j, v)),
    align: String(p.prop(i, 'layout.alignSelf') ?? ''),
    display: p.prop(i, 'layout.display'),
  };
}
function intrinsic(p: Player, i: number): Size {
  const n = p.model.nodes[i]!,
    r = n.raw,
    type = n.type as string;
  if (type === 'text') {
    const width = p.prop(i, 'layout.width'),
      max = p.prop(i, 'layout.maxWidth');
    const b = measureText(
      p,
      i,
      typeof width === 'number' ? width : typeof max === 'number' ? max : undefined,
    );
    return [b?.width ?? 0, b?.height ?? 0];
  }
  if (type === 'instance') {
    const c =
      (p.nested as { players?: Map<string, Player> } | undefined)?.players?.get(n.id)?.model ??
      p.model.doc.components?.[r.component];
    return c?.viewBox?.slice(2) ?? [c?.grid ?? 0, c?.grid ?? 0];
  }
  if (type === 'image') {
    const asset = p.model.doc.assets?.[p.prop(i, 'asset') as string];
    return [
      p.prop(i, 'layout.width') === 'hug'
        ? (asset?.width ?? p.num(i, 'width', 0))
        : p.num(i, 'width', asset?.width ?? 0),
      p.prop(i, 'layout.height') === 'hug'
        ? (asset?.height ?? p.num(i, 'height', 0))
        : p.num(i, 'height', asset?.height ?? 0),
    ];
  }
  if (type === 'rect') return [p.num(i, 'w', 0), p.num(i, 'h', 0)];
  if (type === 'circle' || type === 'arc') return [2 * p.num(i, 'r', 0), 2 * p.num(i, 'r', 0)];
  let outline: { pts: number[]; closed: boolean }[] | undefined;
  for (const m of geometryModules.values())
    if (m.name !== 'layout' && (outline = m.outline?.(p, i))) break;
  const points = (outline ?? (n.d ? flatten(parsePath(n.d)) : [])).flatMap((s) => s.pts);
  return pathBox(points).slice(2) as Size;
}
function pathBox(points: number[]) {
  const x = points.filter((_, k) => k % 2 === 0),
    y = points.filter((_, k) => k % 2 === 1),
    left = Math.min(...x),
    top = Math.min(...y);
  return x.length ? [left, top, Math.max(...x) - left, Math.max(...y) - top] : [0, 0, 0, 0];
}

export function resolveLayout(p: Player): void {
  let state = states.get(p);
  if (!state)
    states.set(
      p,
      (state = { boxes: new Map(), drawn: new Map(), signatures: new Map(), measured: new Map() }),
    );
  const { boxes, signatures, measured } = state,
    natural = new Map<number, Size>();
  // Refresh at the previous allocation, so unchanged wrapping does not churn intermediate boxes.
  for (const [i, m] of measured) measured.set(i, measureText(p, i, m.width)!);
  const update = (i: number, box: Box) => {
    const old = boxes.get(i);
    if (!old || Object.keys(box).some((k) => box[k as keyof Box] !== old[k as keyof Box])) {
      boxes.set(i, box);
      p.drawVersions[i] = ++p.drawRevision;
    }
  };
  const item = (i: number): Item => {
    const c = configuration(p, i),
      size = natural.get(i) ?? intrinsic(p, i),
      m = measured.get(i);
    if (m) size[1] = m.height;
    return {
      id: i,
      ...c,
      size: axes.map((_, a) =>
        clamp(
          typeof c.mode[a] === 'number' ? (c.mode[a] as number) : size[a]!,
          c.min[a]!,
          c.max[a]!,
        ),
      ) as Size,
      baseline:
        (p.model.nodes[i]!.type as string) === 'text'
          ? (measured.get(i)?.baseline ?? measureText(p, i)?.baseline ?? size[1])
          : size[1],
    };
  };
  const children = (i: number) =>
    p.model.nodes[i]!.children.filter((k) => p.prop(k, 'layout.display') !== 'none');
  const spacing = (i: number, key: string) =>
    edges(p.prop(i, key)).map((v, j) => p.num(i, key + '.' + j, v));
  const settings = (i: number) => {
    const direction = String(p.prop(i, 'direction') ?? 'row'),
      gap = p.prop(i, 'gap') ?? 0;
    return {
      padding: spacing(i, 'padding'),
      direction,
      gap: p.num(
        i,
        'gap.' + (direction.startsWith('column') ? 0 : 1),
        typeof gap === 'number'
          ? gap
          : ((gap as number[])[direction.startsWith('column') ? 0 : 1] ?? (gap as number[])[0]!),
      ),
      justify: String(p.prop(i, 'justify') ?? 'start'),
      align: String(p.prop(i, 'align') ?? 'start'),
    };
  };
  let changed = true;
  for (let pass = 0; changed && pass <= p.model.nodes.length; pass++) {
    changed = false;
    // Bottom-up intrinsic sizes, then top-down allocation (a nested fill receives its actual box).
    for (let i = p.model.nodes.length - 1; i >= 0; i--)
      if ((p.model.nodes[i]!.type as string) === 'layout') {
        const s = settings(i),
          a = s.direction.startsWith('column') ? 1 : 0,
          b = 1 - a,
          items = children(i).map(item),
          size: Size = [0, 0];
        items.forEach((c) => {
          size[a] += c.size[a]! + c.margin[a === 0 ? 1 : 0]! + c.margin[a === 0 ? 3 : 2]!;
          size[b] = Math.max(
            size[b]!,
            c.size[b]! + c.margin[b === 0 ? 1 : 0]! + c.margin[b === 0 ? 3 : 2]!,
          );
        });
        if (a === 0) {
          const baseline = items.filter((c) => (c.align || s.align) === 'baseline');
          size[1] = Math.max(
            size[1],
            Math.max(0, ...baseline.map((c) => c.margin[0]! + c.baseline)) +
              Math.max(0, ...baseline.map((c) => c.margin[2]! + c.size[1] - c.baseline)),
          );
        }
        size[a] += Math.max(0, items.length - 1) * s.gap;
        size[0] += s.padding[1]! + s.padding[3]!;
        size[1] += s.padding[0]! + s.padding[2]!;
        const c = configuration(p, i);
        natural.set(
          i,
          size.map((v, k) =>
            clamp(
              p.layoutSize && (p.model.nodes[p.model.nodes[i]!.parent]?.type as string) !== 'layout'
                ? p.layoutSize[k]!
                : typeof c.mode[k] === 'number'
                  ? (c.mode[k] as number)
                  : weight(c.mode[k]) &&
                      (p.model.nodes[p.model.nodes[i]!.parent]?.type as string) !== 'layout'
                    ? p.model.viewBox[k + 2]!
                    : v,
              c.min[k]!,
              c.max[k]!,
            ),
          ) as Size,
        );
      }
    for (const [i, n] of p.model.nodes.entries())
      if ((n.type as string) === 'layout') {
        const s = settings(i),
          items = children(i).map(item),
          assigned = boxes.get(i),
          size: Size =
            n.parent >= 0 && (p.model.nodes[n.parent]!.type as string) === 'layout' && assigned
              ? [assigned.width, assigned.height]
              : natural.get(i)!;
        if (n.parent < 0 || (p.model.nodes[n.parent]!.type as string) !== 'layout')
          update(i, { x: p.num(i, 'x', 0), y: p.num(i, 'y', 0), width: size[0], height: size[1] });
        const signature = JSON.stringify([items, size, s]);
        if (signatures.get(i) === signature) continue;
        signatures.set(i, signature);
        const result = arrange(items, size, s.padding, s.direction, s.gap, s.justify, s.align);
        items.forEach((c, k) => {
          const box = result[k]!;
          if ((p.model.nodes[c.id]!.type as string) === 'text') {
            const m = measureText(p, c.id, box.width)!;
            const old = measured.get(c.id);
            if (!old || old.height !== m.height || old.width !== m.width) changed = true;
            measured.set(c.id, m);
          }
          update(c.id, box);
        });
        for (const k of n.children)
          if (p.prop(k, 'layout.display') === 'none')
            update(k, { x: 0, y: 0, width: 0, height: 0 });
      }
  }
  state.drawn = layout.reflow?.(p, boxes) ?? boxes;
}
export const layout: LayoutModule = {
  name: 'layout',
  after,
  entries,
  init(registry, shared) {
    geometryModules = registry;
    if (V) {
      layout.reflow = reflow;
      layout.validateReflow = validateReflow;
    }
    text = registry.get('text') as TextModule | undefined;
    const guard = registry.get('machine')?.entries.find((e) => e.target === 'transition')?.shapes
      .guard as ObjShape | undefined;
    if (guard)
      for (const key of ['left', 'right']) {
        const operand = guard.p[key];
        if (operand?.k === 'alt')
          for (const form of operand.of)
            if (form.k === 'obj') form.p.layout = { k: 'str', feature: 'layout' };
      }
    shared.Player.prototype.machineLayout = function (address) {
      const dot = address.lastIndexOf('.'),
        box = layoutBox(this, address.slice(0, dot));
      return box?.[address.slice(dot + 1) as keyof Box] ?? 0;
    };
    if (!shared.Player.prototype.layoutBox) {
      const values = shared.Player.prototype.values;
      shared.Player.prototype.values = function () {
        const result = values.call(this);
        for (const [i, box] of states.get(this)?.boxes ?? [])
          for (const [key, value] of Object.entries(box))
            result[this.model.nodes[i]!.id + '.layoutBox.' + key] = value;
        return result;
      };
      shared.Player.prototype.drawnLayoutBox = function (id) {
        return layoutBox(this, id, true);
      };
      shared.Player.prototype.layoutBox = function (id) {
        return layoutBox(this, id);
      };
    }
    return layout;
  },
  model(n: NodeM, key: string) {
    const prefix = key.startsWith('layout.') ? 'layout.' : '',
      field = key.slice(prefix.length);
    if (!prefix && (n.type as string) !== 'layout') return;
    const raw = prefix ? n.raw.layout : n.raw;
    if (prefix && field === 'display')
      return {
        prop: { type: 'string', feature: 'layout', discrete: true },
        rest: raw?.display ?? 'flex',
      };
    const match =
      /^(width|height|gap|padding|margin|corners|minWidth|minHeight|maxWidth|maxHeight)(?:\.([0-3]))?$/.exec(
        field,
      );
    if (
      !match ||
      (match[2] !== undefined &&
        (!['gap', 'padding', 'margin'].includes(match[1]!) ||
          (match[1] === 'gap' && +match[2] > 1)))
    )
      return;
    let rest = raw?.[match[1]!];
    if (match[2] !== undefined) rest = edges(rest)[+match[2]];
    if (rest === undefined) rest = 0;
    if (typeof rest !== 'number') rest = 0;
    return {
      prop: { type: 'number', min: match[1] === 'margin' ? undefined : 0, feature: 'layout' },
      rest,
    };
  },
  value(addr, value) {
    if (
      addr.prop.feature === 'layout' &&
      addr.prop.type === 'string' &&
      (value === 'none' || value === 'flex')
    )
      return value;
  },
  load(model: Model, _raw: Model['doc'], d: Diags) {
    if (!model.doc.requires?.includes('layout')) return;
    layout.validateReflow?.(model, d);
    if (V)
      for (const [i, n] of model.nodes.entries())
        if ((n.type as string) === 'layout') {
          const pointer = nodePointer(model, i),
            index = d.list.findIndex((v) => v.code === 'no-paint' && v.pointer === pointer);
          if (index >= 0) d.list.splice(index, 1);
        }
    if (V)
      for (const [name, layer] of Object.entries(model.doc.machine?.layers ?? {}) as [
        string,
        {
          states: Record<
            string,
            { on?: { guard?: { left?: { layout?: string }; right?: { layout?: string } } }[] }
          >;
        },
      ][])
        for (const [state, s] of Object.entries(layer.states))
          for (const [i, t] of (s.on ?? []).entries())
            for (const key of ['left', 'right'] as const) {
              const target = t.guard?.[key]?.layout;
              if (target !== undefined) {
                const match = /^([^.]+)\.(x|y|width|height)$/.exec(target),
                  ni = match && model.ids.get(match[1]!);
                if (
                  ni === undefined ||
                  ni === null ||
                  !(
                    (model.nodes[ni]!.type as string) === 'layout' ||
                    (model.nodes[model.nodes[ni]!.parent]?.type as string) === 'layout'
                  )
                )
                  d.err(
                    'layout-target',
                    `/machine/layers/${name}/states/${state}/on/${i}/guard/${key}/layout`,
                    'unknown layout box target',
                    'use a layout container or participant id followed by .x, .y, .width or .height',
                  );
              }
            }
    if (V)
      for (const [i, n] of model.nodes.entries()) {
        const at = nodePointer(model, i),
          parent = model.nodes[n.parent];
        const error = (code: string, key: string, message: string, hint: string) =>
          d.err(code, at + key, message, hint);
        const childAddress = [...model.addrs].find(
          ([, a]) => a.node === i && a.key.startsWith('layout.'),
        )?.[0];
        if ((n.raw.layout || childAddress) && (parent?.type as string) !== 'layout') {
          if (n.raw.layout)
            error(
              'layout-outside',
              '/layout',
              'layout child properties need a layout parent',
              'move the node inside a layout container',
            );
          else
            d.err(
              'layout-outside',
              model.doc.bind?.[childAddress!] !== undefined ? '/bind/' + childAddress : at,
              'layout child properties need a layout parent',
              'move the node inside a layout container',
            );
        }
        for (const [prefix, raw] of [
          ['', (n.type as string) === 'layout' ? n.raw : undefined],
          ['/layout', n.raw.layout],
        ] as const)
          if (raw) {
            for (const key of ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'])
              if (raw[key] !== undefined && raw[key] < 0)
                error(
                  'layout-value',
                  prefix + '/' + key,
                  'layout bounds must be nonnegative',
                  'use nonnegative grid lengths',
                );
            for (const a of axes) {
              const cap = a[0]!.toUpperCase() + a.slice(1),
                value = raw[a];
              if (
                value !== undefined &&
                !(typeof value === 'number' && value >= 0) &&
                value !== 'hug' &&
                !(weight(value) > 0 && Number.isFinite(weight(value)))
              )
                error(
                  'layout-value',
                  prefix + '/' + a,
                  'invalid layout length or fill weight',
                  'use a nonnegative number, hug, fill or fill(weight > 0)',
                );
              if ((raw['min' + cap] ?? 0) > (raw['max' + cap] ?? Infinity))
                error(
                  'layout-bounds',
                  prefix + '/min' + cap,
                  'minimum exceeds maximum',
                  'use min <= max',
                );
              if (
                weight(value) &&
                parent &&
                (parent.type as string) === 'layout' &&
                (parent.raw.layout?.[a] ?? parent.raw[a] ?? 'hug') === 'hug' &&
                !model.addrs.has(
                  parent.id +
                    '.' +
                    (parent.raw.layout?.[a] !== undefined ||
                    model.addrs.has(parent.id + '.layout.' + a)
                      ? 'layout.'
                      : '') +
                    a,
                )
              )
                error(
                  'layout-fill-hug',
                  prefix + '/' + a,
                  'fill cannot resolve against a hug parent',
                  'give the parent a fixed size or use hug for the child',
                );
            }
            for (const key of ['padding', 'margin', 'gap'])
              if (raw[key] !== undefined) {
                const values = typeof raw[key] === 'number' ? [raw[key]] : raw[key];
                if (
                  !Array.isArray(values) ||
                  values.length > (key === 'gap' ? 2 : 4) ||
                  !values.length ||
                  values.some(
                    (v: unknown) =>
                      typeof v !== 'number' || !Number.isFinite(v) || (key !== 'margin' && v < 0),
                  )
                )
                  error(
                    'layout-value',
                    prefix + '/' + key,
                    'invalid spacing',
                    'use 1–4 finite grid lengths (gap: 1–2); padding and gap are nonnegative',
                  );
              }
          }
      }
  },
  resolve(model) {
    if (!model.doc.requires?.includes('layout')) return;
    const initialize = model.nesting;
    model.nesting = (p) => {
      const nested = initialize?.(p),
        local = p.local.bind(p),
        visible = p.visible.bind(p);
      p.hitFrame = () => drawFrame(p);
      p.local = (i) => {
        const m = local(i),
          box = drawn(p, i);
        if (box) {
          m[4] += box.x - p.num(i, 'x', 0);
          m[5] += box.y - p.num(i, 'y', 0);
        }
        return m;
      };
      p.visible = (i) => {
        for (let n = i; n >= 0; n = p.model.nodes[n]!.parent)
          if (p.prop(n, 'layout.display') === 'none') return false;
        return visible(i);
      };
      resolveLayout(p);
      return nested;
    };
    const previous = model.afterStep;
    model.afterStep = (p) => {
      previous?.(p);
      resolveLayout(p);
    };
  },
  draw: {
    tree(model, tree) {
      for (const [i, n] of model.nodes.entries())
        if ((n.type as string) === 'layout') {
          tree.nodes[i]!.kind = 'group';
          (tree.nodes[i]! as import('./svg.ts').LayoutEntry).layout = true;
        }
    },
    frame(p, i, data) {
      const box = drawn(p, i),
        n = p.model.nodes[i]!,
        type = n.type as string;
      if (p.prop(i, 'layout.display') === 'none') data.visible = false;
      if (!box) return;
      if (type === 'layout')
        data.geometry = {
          kind: 'rect',
          x: 0,
          y: 0,
          width: box.width,
          height: box.height,
          rx: p.num(i, 'corners', 0),
        };
      else if (type === 'rect' || type === 'image') {
        if (data.geometry) {
          data.geometry.x = data.geometry.y = 0;
          data.geometry.width = box.width;
          data.geometry.height = box.height;
        }
      } else if (type === 'text') {
        const input = text!.input(p, i);
        const sizing = textSizing(input);
        input.sizing = sizing === 'fixed' ? 'fixed' : 'auto-height';
        input.width =
          sizing === 'auto-width' ? box.width : Math.min(input.width ?? Infinity, box.width);
        (data as TextDrawNode).text!.layout =
          text!.fonts?.prepareText?.(p, input)?.layout ?? text!.layout(input, text!.overflow);
      } else {
        const size = intrinsic(p, i);
        const sx = size[0] ? box.width / size[0] : 1,
          sy = size[1] ? box.height / size[1] : 1;
        let x = 0,
          y = 0;
        if (type === 'circle' || type === 'arc') {
          x = n.raw.center[0] - p.num(i, 'r', 0);
          y = n.raw.center[1] - p.num(i, 'r', 0);
        }
        if (data.geometry?.d) {
          const points = flatten(parsePath(data.geometry.d)).flatMap((s) => s.pts);
          [x, y] = pathBox(points) as [number, number, number, number];
        }
        data.transform = mul(data.transform, [sx, 0, 0, sy, -x * sx, -y * sy]);
      }
    },
  },
};
