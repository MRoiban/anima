// Shared layout rules; formatting never interprets attribute values as animation data.
import { ELEMENTS, markupName, type NodeType } from '@anima-format/core';
import { NODE_ELEMENTS, nodeAttrs } from './names.ts';
import { escapeAttr, escapeText } from './xml.ts';

export interface LayoutElement {
  name: string;
  attrs: [string, string][];
  children: LayoutChild[];
  blank?: boolean;
}
export type LayoutChild = LayoutElement | { comment: string; blank?: boolean } | { text: string };

export const ATTR_ORDER: Record<string, string[]> = {
  anima: ['version', 'name', 'title', 'grid', 'viewBox', 'requires', 'xmlns'],
  meta: [],
  color: ['name', 'value'],
  glyph: ['name', 'd', 'source', 'pick', 'sha256'],
  a11y: ['role', 'label', 'activate', 'pressed', 'held'],
  bool: ['name', 'default'],
  number: ['name', 'default', 'min', 'max'],
  trigger: ['name', 'buffer'],
  hit: ['circle', 'rect'],
  ease: ['name', 'curve'],
  timeline: ['name', 'duration', 'loop', 'reducedMotion'],
  track: ['target'],
  event: ['at', 'name'],
  layer: ['name', 'initial'],
  state: ['name', 'play', 'speed', 'emit'],
  on: ['when', 'to', 'blend', 'ease', 'interruptible'],
  listener: ['on', 'target', 'hitPadding', 'fire', 'set', 'toggle', 'emit'],
};
export function attrOrder(name: string): string[] {
  const form = ELEMENTS[name];
  if (form)
    return [
      ...(form.target ? [form.target.attribute] : []),
      ...Object.entries(form.shape.p)
        .filter(([, s]) => s.k !== 'arr')
        .map(([k, s]) => markupName(s, k)),
    ];
  return NODE_ELEMENTS.includes(name)
    ? ['id', ...nodeAttrs(name as NodeType).map((a) => a.attr)]
    : (ATTR_ORDER[name] ?? []);
}

/** Split only the first two columns: ease arguments may themselves contain spaces. */
export function keyColumns(text: string): string[][] {
  return text
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = /^(\S+)\s+(\S+)(?:\s+(.*))?$/.exec(s);
      return m ? [m[1]!, m[2]!, ...(m[3] ? [m[3]] : [])] : [s];
    });
}
export function alignedKeys(rows: string[][], widths = [0, 0]): string {
  for (const row of rows)
    for (let i = 0; i < 2; i++) widths[i] = Math.max(widths[i]!, row[i]?.length ?? 0);
  return rows
    .map((row) => row.map((v, i) => (i < row.length - 1 ? v.padEnd(widths[i]! + 2) : v)).join(''))
    .join('\n');
}

export function render(el: LayoutElement, depth = 0): string {
  const indent = '  '.repeat(depth);
  const order = attrOrder(el.name);
  const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length);
  const attrs = [...el.attrs].sort((a, b) => rank(a[0]) - rank(b[0]));
  let open = `${indent}<${el.name}`;
  let continuation = false;
  for (const [key, value] of attrs) {
    // A long value occupies its own line; subsequent attributes cannot share that line.
    const long = value.length > 80;
    open += `${long || continuation ? `\n${indent}    ` : ' '}${key}="${escapeAttr(value)}"`;
    continuation = long;
  }
  if (!el.children.length) return open + '/>';
  const onlyText = el.children.every((c) => 'text' in c);
  if (onlyText) {
    const text = el.children.map((c) => (c as { text: string }).text).join('');
    if (el.name === 'track') {
      const rows = keyColumns(text);
      if (text.includes(';'))
        return `${open}>${escapeText(rows.map((r) => r.join(' ')).join('; '))}</${el.name}>`;
      const body = alignedKeys(rows)
        .split('\n')
        .map((s) => indent + '  ' + escapeText(s))
        .join('\n');
      return `${open}>\n${body}\n${indent}</${el.name}>`;
    }
    return `${open}>${escapeText(text.trim())}</${el.name}>`;
  }
  const body: string[] = [];
  const trackTexts = el.children.filter((c): c is { text: string } => 'text' in c);
  const inlineTrack = el.name === 'track' && trackTexts.some((c) => c.text.includes(';'));
  const widths = [0, 0];
  if (el.name === 'track')
    alignedKeys(
      trackTexts.flatMap((c) => keyColumns(c.text)),
      widths,
    );
  for (const c of el.children) {
    if (depth === 0 && 'blank' in c && c.blank && body.length) body.push('');
    if ('comment' in c) body.push(`${indent}  <!--${c.comment}-->`);
    else if ('text' in c) {
      const text =
        el.name === 'track'
          ? inlineTrack
            ? keyColumns(c.text)
                .map((r) => r.join(' '))
                .join('; ') + (c !== trackTexts.at(-1) ? ';' : '')
            : alignedKeys(keyColumns(c.text), widths)
          : c.text.trim();
      if (text) {
        if (el.name === 'track')
          body.push(...text.split('\n').map((s) => indent + '  ' + escapeText(s)));
        else body.push(indent + '  ' + escapeText(text));
      }
    } else body.push(render(c, depth + 1));
  }
  return `${open}>\n${body.join('\n')}\n${indent}</${el.name}>`;
}
