import type { Module } from '../../../packages/core/src/modules.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { TextModule, TextDrawNode } from '../../text/core/index.ts';
import type { a11y } from '../../a11y/core/index.ts';
import type { ObjShape, Shape } from '../../../packages/core/src/registry.ts';
import type { SemanticNode } from '../../a11y/core/types.ts';
import { apply } from '../../../packages/core/src/geom.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { registerEventKinds } from '../../components/core/events.ts';
import { nodePointer } from '../../components/core/node-pointer.ts';
import { entries } from './registry.ts';
import { after } from '../manifest.ts';
export interface FieldConfig {
  editable?: boolean;
  multiline?: boolean;
  obscured?: boolean;
  placeholder?: string;
  selectOnFocus?: boolean;
  maxLength?: number;
  maxLines?: number;
  writeText?: string;
  label?: string;
  caretColor?: string;
  selectionColor?: string;
  selectionRadius?: number;
}
export interface Field {
  value: string;
  committed: string;
  start: number;
  end: number;
  composing: boolean;
}
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  radius: number;
}
export type FieldNode = TextDrawNode & { fieldBoxes?: Box[] };
let text: TextModule;
let semanticsRuntime: typeof a11y.runtime | undefined;
let previousUpdate: typeof a11y.runtime.update;
const update: NonNullable<typeof a11y.runtime.update> = (p, cache, old) => {
  const live = new Map(semanticsRuntime!.flat(cache.tree).map((n) => [n.id, n]));
  for (const e of cache.entries) {
    const c = config(e.p, e.i);
    if (!c || !e.visible) continue;
    e.config = { role: 'text-field' };
    e.data.readonly = c.editable === false;
    let parent = cache.entries.find((n) => n.id === e.parent);
    while (parent && !parent.config) parent = cache.entries.find((n) => n.id === parent!.parent);
    const container = parent ? live.get(parent.id)?.children : cache.tree;
    if (!container || container.some((n) => n.states.modal)) continue;
    const raw = e.p.model.nodes[e.i]!.raw;
    const f = field(e.p, raw.id)!;
    const points = [
      [0, 0],
      [raw.width, 0],
      [0, raw.height],
      [raw.width, raw.height],
    ].map(([x, y]) => apply(e.matrix, x!, y!));
    const xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]);
    e.bounds = [
      Math.min(...xs),
      Math.min(...ys),
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    ];
    container.push({
      id: e.id,
      role: 'text-field',
      label: c.label ?? c.placeholder ?? raw.id,
      ...(c.obscured ? {} : { value: f.value }),
      states: {
        readonly: c.editable === false,
        multiline: !!c.multiline,
        obscured: !!c.obscured,
        focused: p.focused === e.id,
      } as SemanticNode['states'],
      bounds: e.bounds,
      actions: [],
      children: [],
    });
  }
  return previousUpdate?.(p, cache, old) ?? false;
};
const states = new WeakMap<Player, Map<number, Field>>();
const installed = new WeakSet<object>();
export const config = (p: Player, i: number): FieldConfig | undefined =>
  p.model.nodes[i]?.raw.textInput;
export function field(p: Player, id: string): Field | undefined {
  const i = p.model.ids.get(id);
  if (i === undefined || !config(p, i)) return;
  let map = states.get(p);
  if (!map) states.set(p, (map = new Map()));
  let f = map.get(i);
  if (!f) {
    const r = p.model.nodes[i]!.raw.runs[0];
    const value = String(p.get(config(p, i)!.writeText ?? '') ?? r.text);
    f = { value, committed: value, start: value.length, end: value.length, composing: false };
    map.set(i, f);
  }
  return f;
}
export function edit(
  p: Player,
  id: string,
  value: string,
  start = value.length,
  end = start,
  composing = false,
): Field | undefined {
  const f = field(p, id),
    i = p.model.ids.get(id);
  if (!f || i === undefined) return;
  const c = config(p, i)!;
  if (c.editable === false) return f;
  value = value.replace(/\r\n?/g, '\n');
  value = c.multiline
    ? value.split('\n').slice(0, c.maxLines).join('\n')
    : value.replace(/\n/g, '');
  value = value.slice(0, c.maxLength);
  // Never retain half of a surrogate pair at the maxlength boundary.
  if (/[\uD800-\uDBFF]$/.test(value)) value = value.slice(0, -1);
  const committed = !composing && f.committed !== value;
  Object.assign(f, {
    value,
    start: Math.max(0, Math.min(start, value.length)),
    end: Math.max(0, Math.min(end, value.length)),
    composing,
  });
  if (committed) {
    f.committed = value;
    if (c.writeText) p.set(c.writeText, value);
    for (const l of p.model.listeners) if (l.target === i && l.on === 'text') p.act(l);
  }
  semanticsRuntime?.caches.delete(p);
  text.invalidateText(p);
  p.onChange?.();
  return f;
}
export function select(p: Player, id: string, start: number, end = start): Field | undefined {
  const f = field(p, id);
  if (!f) return;
  f.start = Math.max(0, Math.min(start, f.value.length));
  f.end = Math.max(f.start, Math.min(end, f.value.length));
  semanticsRuntime?.caches.delete(p);
  text.invalidateText(p);
  p.onChange?.();
  return f;
}
export const textinput: Module & { field: typeof field; edit: typeof edit; select: typeof select } =
  {
    name: 'textinput',
    after,
    entries,
    field,
    edit,
    select,
    init(registry, shared) {
      text = registry.get('text') as TextModule;
      registerEventKinds(registry, 'textinput', ['text']);
      const on = (
        (shared.DOC as ObjShape).p.listeners as { of: { p: Record<string, { re?: RegExp }> } }
      ).of.p.on! as Extract<Shape, { k: 'str' }>;
      if (text && !installed.has(text)) {
        installed.add(text);
        const previous = text.override;
        text.override = (p, i, run) => {
          const c = config(p, i);
          if (!c) return previous?.(p, i, run);
          const f = field(p, p.model.nodes[i]!.id)!;
          return f.value
            ? c.obscured
              ? f.value.replace(/[^\n]/g, '•')
              : f.value
            : c.placeholder || '';
        };
      }
      const focus = shared.Player.prototype.focusTarget;
      if (focus && !installed.has(focus)) {
        shared.Player.prototype.focusTarget = function (id) {
          const changed = focus.call(this, id);
          if (changed) text?.invalidateText(this);
          if (changed && id) {
            const i = this.model.ids.get(id),
              f = field(this, id);
            if (f && i !== undefined && config(this, i)?.selectOnFocus)
              select(this, id, 0, f.value.length);
          }
          return changed;
        };
        installed.add(shared.Player.prototype.focusTarget);
      }
      const base = registry.get('a11y') as typeof a11y | undefined;
      semanticsRuntime = base?.runtime;
      if (semanticsRuntime) {
        if (semanticsRuntime.update !== update) previousUpdate = semanticsRuntime.update;
        semanticsRuntime.update = update;
      }
      return {
        ...textinput,
        entries: [
          ...(text ? entries : []),
          {
            target: 'listener',
            shapes: {
              on: { ...on, feature: '', re: new RegExp('(?:' + on.re?.source + ')|^text$') },
            },
          },
        ],
      };
    },
    resolve(model, d) {
      if (!model.doc.requires?.includes('textinput')) return;
      const step = model.afterStep;
      model.afterStep = (p) => {
        for (const [i, f] of states.get(p) ?? []) {
          const c = config(p, i)!;
          const value = c.writeText ? p.get(c.writeText) : undefined;
          if (!f.composing && typeof value === 'string' && value !== f.value) {
            f.value = value;
            f.committed = value;
            f.start = Math.min(f.start, value.length);
            f.end = Math.min(f.end, value.length);
            semanticsRuntime?.caches.delete(p);
            text.invalidateText(p);
          }
        }
        step?.(p);
      };
      for (const [i, n] of model.nodes.entries()) {
        const c = n.raw.textInput as FieldConfig | undefined;
        if (!c) continue;
        const error = (key: string, message: string, hint: string) =>
          d.err('text-input-config', nodePointer(model, i) + key, V && message, V && hint);
        if (
          !model.doc.requires?.includes('focus') ||
          !model.doc.requires?.includes('text') ||
          !model.doc.requires?.includes('a11y')
        )
          error(
            '/textInput',
            'fields require text, focus and a11y',
            'add text, focus and a11y to requires',
          );
        if (
          !Array.isArray(n.raw.runs) ||
          n.raw.runs.length !== 1 ||
          n.raw.runs[0].text.startsWith('$')
        )
          error(
            '/runs',
            'fields require one literal text run',
            'put the initial text in one run; use write-text for data',
          );
        if (n.raw.sizing !== 'fixed' || !n.raw.width || !n.raw.height)
          error(
            '/textInput',
            'fields require a nonempty fixed box',
            'set sizing, width and height',
          );
        if (n.raw.a11y)
          error('/a11y', 'the native field owns semantics', 'set label on text-input instead');
        if (c.multiline && c.obscured)
          error(
            '/textInput/obscured',
            'multiline password fields are unsupported',
            'use a single-line obscured field',
          );
        if (c.maxLines !== undefined && !c.multiline)
          error('/textInput/maxLines', 'line limits require multiline', 'set multiline=true');
        if (c.writeText) {
          const input = model.inputs.get(c.writeText);
          if (!input || input.type !== 'string' || input.readonly)
            error(
              '/textInput/writeText',
              'write-text requires a writable string',
              'declare a string data property or input',
            );
        }
        if (!n.raw.focus)
          n.raw = {
            ...n.raw,
            focus: { bounds: [0, 0, n.raw.width, n.raw.height], tabStops: true },
          };
      }
    },
    draw: {
      frame(p, i, node) {
        const c = config(p, i);
        if (!c) return;
        const f = field(p, p.model.nodes[i]!.id)!;
        const boxes: Box[] = [];
        if (p.focused === p.model.nodes[i]!.id) {
          const layout = text.textLayout(p, i);
          for (const line of layout.lines) {
            const gs = line.clusters;
            const chosen = gs.filter((g) => g.index < f.end && g.index + g.text.length > f.start);
            const first = chosen[0],
              last = chosen.at(-1);
            if (first && last)
              boxes.push({
                x: first.x,
                y: line.baseline - line.ascent,
                width: last.x + last.advance - first.x,
                height: line.ascent + line.descent,
                color: c.selectionColor ?? '#b3d4fc',
                radius: c.selectionRadius ?? 0,
              });
            if (f.start === f.end) {
              const g = gs.find((g) => g.index >= f.start);
              if (g || line === layout.lines.at(-1))
                boxes.push({
                  x: g?.x ?? (gs.at(-1) ? gs.at(-1)!.x + gs.at(-1)!.advance : 0),
                  y: line.baseline - line.ascent,
                  width: 0.06,
                  height: line.ascent + line.descent,
                  color: c.caretColor ?? '#000',
                  radius: 0,
                });
              if (g) break;
            }
          }
        }
        (node as FieldNode).fieldBoxes = boxes;
      },
    },
  };
