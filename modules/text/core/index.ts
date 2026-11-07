import type { Module } from '../../../packages/core/src/modules.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { Model } from '../../../packages/core/src/load.ts';
import type { DrawNode, DrawPaint } from '../../../packages/core/src/draw.ts';
import { parseHex } from '../../../packages/core/src/color.ts';
import { drawColor } from '../../../packages/core/src/draw.ts';
import { nodePointer } from '../../components/core/node-pointer.ts';
import { ptr } from '../../../packages/core/src/diag.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { after } from '../manifest.ts';
import { entries, styleShape } from './registry.ts';
// seam(P6-7): tooling gets listener hit testing; browser pays only in text-hit.
import { installTextHit } from './hit.ts';
import type { TextRunAccess } from './host.ts';
export { textRun, createTextRunAccess } from './host.ts';
import type { ObjShape, Shape } from '../../../packages/core/src/registry.ts';
import { fontRevision } from './measure.ts';
import {
  layoutText,
  textSizing,
  styleDefaults,
  type LayoutInput,
  type TextLayout,
  type TextRun,
  type TextStyle,
} from './layout.ts';
export * from './measure.ts';
export * from './layout.ts';
let fonts: import('../../fonts/core/index.ts').FontModule | undefined;
let data: import('../../data/core/index.ts').DataModule | undefined;
const cache = new WeakMap<
  Player,
  Map<number, { signature: string; layout: TextLayout; input: LayoutInput }>
>();
export interface TextDrawing {
  layout: TextLayout;
  styles: Record<string, TextStyle>;
  runs: TextRun[];
  paints: DrawPaint[][];
}
export type TextDrawNode = DrawNode & { text?: TextDrawing };
const nodes = (m: Model) => m.nodes.flatMap((n, i) => (String(n.type) === 'text' ? [i] : []));
export function invalidateText(p: Player): void {
  cache.delete(p);
  for (const i of nodes(p.model)) p.drawVersions[i] = ++p.drawRevision;
}
export function textLayout(p: Player, i: number): TextLayout {
  return resolveText(p, i).layout;
}
function textInput(p: Player, i: number): LayoutInput {
  const raw = p.model.nodes[i]!.raw;
  const read = (v: string) => (v.startsWith('$') ? data?.dataState(p)?.read(v) : v);
  const source = typeof raw.runs === 'string' ? read(raw.runs) : raw.runs;
  const value = (r: TextRun & Record<string, string>, ri: number, key: 'text' | 'style') => {
    if (typeof raw.runs === 'string')
      return r[raw[key === 'text' ? 'textField' : 'styleField'] ?? key];
    const authored = r[key] ?? '';
    return authored[0] === '$' ? read(authored) : (p.prop(i, `runs.${ri}.${key}`) ?? authored);
  };
  const runs: TextRun[] = Array.isArray(source)
    ? source.map((r: TextRun & Record<string, string>, ri) => ({
        id: r.id,
        text: text.override?.(p, i, r.id ?? ri) ?? String(value(r, ri, 'text') ?? ''),
        style: String(value(r, ri, 'style') ?? ''),
      }))
    : [];
  const styles = { ...p.model.doc.textStyles, ...raw.styles } as Record<string, TextStyle>;
  for (const [id, style] of Object.entries(styles))
    styles[id] = Object.fromEntries(
      Object.entries({ ...styleDefaults, ...style }).map(([k, v]) => [
        k,
        p.prop(i, `styles.${id}.${k}`) ?? (k === 'lineHeight' ? style.lineHeight : v),
      ]),
    );
  const input: LayoutInput = { ...raw, runs, styles };
  for (const k of ['width', 'height', 'lineHeight', 'paragraphSpacing'] as const)
    input[k] = p.prop(i, k) as number | undefined;
  return input;
}
function resolveText(p: Player, i: number) {
  const input = textInput(p, i);
  const prepared = fonts?.prepareText?.(p, input);
  const signature = JSON.stringify([fontRevision, prepared?.revision, input]);
  let state = cache.get(p);
  if (!state) cache.set(p, (state = new Map()));
  let value = state.get(i);
  if (!value || value.signature !== signature) {
    value = { signature, input, layout: prepared?.layout ?? layoutText(input) };
    state.set(i, value);
    // seam(P6-9b): semantic readers may refresh layout before afterStep checks it.
    p.drawVersions[i] = ++p.drawRevision;
  }
  return value;
}
const paint = (
  p: Player,
  raw: Record<string, unknown> | undefined,
  kind: 'fill' | 'stroke',
): DrawPaint | undefined =>
  raw
    ? ({
        ...raw,
        kind,
        key: kind,
        visible: true,
        color: raw.color ? drawColor(p, raw.color) : undefined,
        coordinates: Object.fromEntries(
          ['x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'fx', 'fy']
            .filter((k) => raw[k] !== undefined)
            .map((k) => [k, raw[k] as number]),
        ),
        stops: (raw.stops as { position: number; color: string }[] | undefined)?.map((s) => ({
          ...s,
          color: drawColor(p, s.color),
        })),
        width: (raw.width as number | undefined) ?? 1,
        cap: (raw.cap as string | undefined) ?? 'round',
        join: (raw.join as string | undefined) ?? 'round',
      } as DrawPaint)
    : undefined;
export interface TextModule extends Module {
  // seam(P6-7): optional text-hit listener adapter.
  hitTest?: (p: Player, i: number, x: number, y: number) => number;
  invalidateText: typeof invalidateText;
  textLayout: typeof textLayout;
  input: typeof textInput;
  override?: (player: Player, node: number, run: string | number) => string | undefined;
  textRun?: TextRunAccess;
}
export const text: TextModule = {
  name: 'text',
  after,
  entries,
  invalidateText,
  textLayout,
  input: textInput,
  init(registry, shared) {
    if (V) installTextHit(text); // seam(P6-7): stripped from the display bundle.
    data = registry.get('data') as typeof data;
    fonts = registry.get('fonts') as typeof fonts;
    if (data) {
      const models = ((shared.DOC as ObjShape).p.data as ObjShape).p.models as Extract<
        Shape,
        { k: 'map' }
      >;
      const properties = (models.of as ObjShape).p.properties as Extract<Shape, { k: 'map' }>;
      const type = (properties.of as ObjShape).p.type as Extract<Shape, { k: 'str' }>;
      type.of = [...type.of!.filter((v) => v !== 'text-style'), 'text-style'];
    }
    return text;
  },
  model(node, key) {
    if (String(node.type) !== 'text') return;
    const m =
      /^(?:runs\.(\d+)\.(text|style)|styles\.([\w-]+)\.(size|weight|tracking|lineHeight|font))$/.exec(
        key,
      );
    if (!m) return;
    const source =
      m[1] === undefined
        ? node.raw.styles?.[m[3]!]
        : Array.isArray(node.raw.runs)
          ? node.raw.runs[Number(m[1])]
          : undefined;
    if (!source) return;
    const field = m[2] ?? m[4]!;
    const rest = source[field] ?? styleDefaults[field as keyof typeof styleDefaults] ?? '';
    const bounds = styleShape.p[field] as { min?: number; max?: number; gt?: number } | undefined;
    return {
      prop: {
        min: bounds?.gt === 0 ? Number.MIN_VALUE : bounds?.min,
        max: bounds?.max,
        type: typeof rest === 'number' ? 'number' : 'string',
        discrete: typeof rest !== 'number',
        feature: 'text',
      },
      rest,
    };
  },
  track(track, addr, keys, pointer, d) {
    if (addr.prop.feature !== 'text' || addr.prop.type !== 'string') return;
    keys.forEach((key, i) => {
      if (key[2] !== undefined && key[2] !== 'hold')
        d.err(
          'bad-ease',
          pointer + '/' + i + '/2',
          V && 'text strings are hold-only',
          V && 'omit ease or use hold',
        );
    });
    track.sample = (time, player) => {
      let i = 0;
      while (i < track.times.length - 1 && time >= track.times[i + 1]! - 1e-9) i++;
      const value = track.values[i]!;
      return typeof value === 'function' ? value(player!) : value;
    };
  },
  value(a, v) {
    if (a.prop.type === 'string' && typeof v === 'string') return v;
  },
  resolve(model, d) {
    const indices = nodes(model);
    if (!indices.length) return;
    for (const i of indices) {
      if (V)
        for (let j = d.list.length - 1; j >= 0; j--)
          if (d.list[j]!.code === 'no-paint' && d.list[j]!.pointer === nodePointer(model, i))
            d.list.splice(j, 1);
      const r = model.nodes[i]!.raw,
        at = nodePointer(model, i);
      const sizing = textSizing(r);
      const error = (key: string, code: string, message: string, hint: string) =>
        d.err(code, at + '/' + key, V && message, V && hint);
      if (
        (sizing === 'fixed' && (r.width === undefined || r.height === undefined)) ||
        (sizing === 'auto-height' && r.width === undefined)
      )
        error(
          'sizing',
          'text-box',
          'sizing needs box dimensions',
          'set width and height for fixed; width for auto-height',
        );
      if (r.overflow && r.overflow !== 'visible' && sizing !== 'fixed')
        error(
          'overflow',
          'text-box',
          'overflow needs a fixed box',
          'set width and height, or use sizing="fixed" with both dimensions',
        );
      if (
        typeof r.runs === 'string' &&
        (!r.runs.startsWith('$') || !model.doc.requires?.includes('data'))
      )
        error(
          'runs',
          'text-source',
          'run list needs a data path',
          'declare data and use runs="$items"',
        );
      const styles = { ...model.doc.textStyles, ...r.styles };
      for (const [name, style] of Object.entries(styles) as [string, TextStyle][])
        for (const kind of ['fill', 'stroke'] as const) {
          const paint = style[kind] as { color?: string; stops?: { color: string }[] } | undefined;
          for (const color of [paint?.color, ...(paint?.stops?.map((s) => s.color) ?? [])])
            if (color && color !== 'currentColor' && !model.colors[color] && !parseHex(color))
              d.err(
                'text-paint',
                ptr(ptr(r.styles?.[name] ? at + '/styles' : '/textStyles', name), kind),
                V && 'invalid text paint color',
                V && 'use a hex color, currentColor or declared color slot',
              );
        }
      const source = (path: string, point: string, expected: string) => {
        const ref = data?.compiled.get(model)?.refs.get(path);
        if (!ref || ref.property.type !== expected)
          error(
            point,
            'text-source',
            'unknown or incompatible text source',
            'use a declared ' + expected + ' data path',
          );
      };
      if (typeof r.runs === 'string') {
        const c = data?.compiled.get(model),
          m = /^\$(?:([\w-]+):)?([\w.-]+)$/.exec(r.runs);
        let v: unknown = m && c?.defaults[m[1] ?? c.defaultName];
        for (const k of m?.[2]?.split('.') ?? [])
          v = v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined;
        if (!Array.isArray(v))
          error('runs', 'text-source', 'unknown run list', 'use a declared list data path');
      }
      if (Array.isArray(r.runs))
        r.runs.forEach((run: TextRun, ri: number) => {
          if (run.text.startsWith('$')) source(run.text, `runs/${ri}/text`, 'string');
          if (run.style?.startsWith('$')) source(run.style, `runs/${ri}/style`, 'text-style');
          if (run.style && !run.style.startsWith('$') && !styles[run.style])
            error(
              `runs/${ri}/style`,
              'text-style',
              'unknown text style',
              'declare a local style or shared text-style',
            );
          if (
            (run.text.startsWith('$') || run.style?.startsWith('$')) &&
            !model.doc.requires?.includes('data')
          )
            error(
              `runs/${ri}`,
              'text-source',
              'bound runs require data',
              'add data to requires and declare the source path',
            );
        });
    }
    const previous = model.afterStep;
    model.afterStep = (p) => {
      previous?.(p);
      for (const i of indices) {
        // No text measurer is needed until a consumer requests layout.
        if (cache.get(p)?.has(i)) resolveText(p, i);
      }
    };
  },
  draw: {
    frame(p, i, node) {
      if (String(p.model.nodes[i]!.type) !== 'text') return;
      const { layout, input } = resolveText(p, i);
      (node as TextDrawNode).text = {
        layout,
        styles: input.styles,
        runs: input.runs,
        paints: input.runs.map((r) => {
          const style = input.styles[r.style ?? ''] ?? {};
          const paints = [
            paint(p, style.fill as Record<string, unknown> | undefined, 'fill'),
            paint(p, style.stroke as Record<string, unknown> | undefined, 'stroke'),
          ].filter((v): v is DrawPaint => !!v);
          return paints.length
            ? paints
            : node.paints.length
              ? node.paints
              : [{ kind: 'fill', color: '#000', visible: true }];
        }),
      };
    },
  },
};
