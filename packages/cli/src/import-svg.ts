/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Diagnostic } from '@anima-format/core';
import { parseXml, type Element } from '../../markup/src/xml.ts';

type RecordValue = Record<string, any>;
export interface Imported {
  doc: RecordValue;
  diagnostics: Diagnostic[];
}
export function importSVG(source: string, name: string): Imported {
  const diagnostics: Diagnostic[] = [];
  const warn = (pointer: string, message: string) =>
    diagnostics.push({
      code: 'import-unsupported',
      severity: 'warning',
      pointer,
      message,
      hint: 'simplify this SVG feature or author it directly in AniML',
    });
  const parsed = parseXml(source);
  if (!parsed.doc.root || parsed.errors.length)
    throw Error('invalid SVG XML: ' + parsed.errors[0]?.message);
  const root = parsed.doc.root;
  if (root.name !== 'svg') throw Error('expected an svg root');
  const attrs = (el: Element) => Object.fromEntries(el.attrs.map((a) => [a.name, a.value]));
  const ra = attrs(root),
    vb = (ra.viewBox ?? `0 0 ${ra.width ?? 24} ${ra.height ?? 24}`)
      .trim()
      .split(/[ ,]+/)
      .map(Number);
  if (vb.length !== 4 || vb.some((v) => !Number.isFinite(v)) || vb[2]! <= 0 || vb[3]! <= 0)
    throw Error('SVG needs a numeric positive viewBox');
  const doc: RecordValue = {
    anima: '0.1',
    name,
    grid: Math.max(vb[2]!, vb[3]!),
    viewBox: vb,
    requires: ['paint'],
    nodes: [],
  };
  const defs = new Map<string, Element>();
  const locations = new Map<Element, string>();
  const scan = (el: Element, pointer: string) => {
    locations.set(el, pointer);
    const a = attrs(el);
    if (a.id) defs.set(a.id, el);
    el.children.forEach((c, i) => {
      if (c.kind === 'element') scan(c, pointer + '/' + i);
    });
  };
  scan(root, '/svg');
  let serial = 0;
  const color = (v: string, pointer: string) => {
    const colors: Record<string, string> = {
      black: '#000000',
      white: '#ffffff',
      red: '#ff0000',
      green: '#008000',
      blue: '#0000ff',
      transparent: '#00000000',
      lime: '#00ff00',
      yellow: '#ffff00',
      aqua: '#00ffff',
      cyan: '#00ffff',
      fuchsia: '#ff00ff',
      magenta: '#ff00ff',
      gray: '#808080',
      grey: '#808080',
      silver: '#c0c0c0',
      maroon: '#800000',
      olive: '#808000',
      purple: '#800080',
      teal: '#008080',
      navy: '#000080',
      orange: '#ffa500',
    };
    v = v.trim();
    if (v.toLowerCase() === 'currentcolor') return 'currentColor';
    if (/^#[0-9a-f]{4}$/i.test(v)) return '#' + [...v.slice(1)].map((c) => c + c).join('');
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return v;
    if (Object.hasOwn(colors, v.toLowerCase())) return colors[v.toLowerCase()]!;
    const rgb = /^rgba?\((.*)\)$/i.exec(v);
    if (rgb) {
      const parts = rgb[1]!.trim().split(/[,\s/]+/);
      if (
        (parts.length === 3 || parts.length === 4) &&
        parts.every((p) => /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?%?$/i.test(p))
      ) {
        const channel = (p: string, max: number) =>
          Math.min(
            max,
            Math.max(0, p.endsWith('%') ? (Number(p.slice(0, -1)) * max) / 100 : Number(p)),
          );
        return (
          '#' +
          [
            ...parts.slice(0, 3).map((p) => Math.round(channel(p, 255))),
            Math.round(channel(parts[3] ?? '1', 1) * 255),
          ]
            .map((n) => n.toString(16).padStart(2, '0'))
            .join('')
        );
      }
    }
    warn(pointer, 'unsupported SVG colour ' + v + '; substituted black');
    return '#000000';
  };
  function paint(value: string, pointer: string): RecordValue | undefined {
    if (value === 'none') return;
    const ref = /^url\(#([^)]+)\)$/.exec(value);
    if (!ref) return { color: color(value, pointer) };
    const el = defs.get(ref[1]!);
    if (!el || !['linearGradient', 'radialGradient'].includes(el.name)) {
      warn(pointer, 'unknown or unsupported paint server ' + value);
      return;
    }
    const a = attrs(el),
      location = locations.get(el)!;
    if (a.gradientUnits !== 'userSpaceOnUse') {
      warn(location, 'objectBoundingBox gradient coordinates are unsupported');
      return;
    }
    const p: RecordValue = { type: el.name === 'linearGradient' ? 'linear' : 'radial' };
    for (const k of el.name === 'linearGradient'
      ? ['x1', 'y1', 'x2', 'y2']
      : ['cx', 'cy', 'r', 'fx', 'fy']) {
      if (a[k] !== undefined && Number.isFinite(Number(a[k]))) p[k] = Number(a[k]);
    }
    if (p.type === 'linear')
      Object.assign(p, { x1: p.x1 ?? 0, y1: p.y1 ?? 0, x2: p.x2 ?? 1, y2: p.y2 ?? 0 });
    else Object.assign(p, { cx: p.cx ?? 0, cy: p.cy ?? 0, r: p.r ?? 1 });
    p.stops = el.children
      .filter((c): c is Element => c.kind === 'element' && c.name === 'stop')
      .map((c) => {
        const s = attrs(c);
        for (const attr of c.attrs)
          if (!['offset', 'stop-color'].includes(attr.name))
            warn(locations.get(c)! + '/@' + attr.name, 'unsupported gradient stop attribute');
        return {
          position: s.offset?.endsWith('%') ? parseFloat(s.offset) / 100 : Number(s.offset ?? 0),
          color: color(s['stop-color'] ?? '#000000', locations.get(c)! + '/@stop-color'),
        };
      });
    for (const key of Object.keys(a))
      if (
        !['id', 'gradientUnits', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'fx', 'fy'].includes(key)
      )
        warn(location + '/@' + key, 'unsupported gradient attribute');
    return p;
  }
  function transform(node: RecordValue, text: string, pointer: string): RecordValue {
    const matches = [...text.matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)];
    if (text.replace(/([a-zA-Z]+)\s*\(([^)]*)\)/g, '').trim())
      warn(pointer, 'unparsed transform syntax');
    // Nested groups preserve SVG's left-to-right transform multiplication.
    for (const [i, m] of matches.entries()) {
      const v = m[2]!.trim().split(/[ ,]+/).map(Number),
        t: RecordValue = {};
      if (v.some((n) => !Number.isFinite(n))) {
        warn(pointer, 'nonnumeric transform');
        continue;
      }
      if (m[1] === 'translate') Object.assign(t, { x: v[0], y: v[1] ?? 0 });
      else if (m[1] === 'scale') Object.assign(t, { scaleX: v[0], scaleY: v[1] ?? v[0] });
      else if (m[1] === 'rotate') Object.assign(t, { rotate: v[0], pivot: [v[1] ?? 0, v[2] ?? 0] });
      else if (m[1] === 'matrix' && v.length === 6) {
        const [a, b, c, d, e, f] = v as [number, number, number, number, number, number];
        const sx = Math.hypot(a, b);
        if (Math.abs(a * c + b * d) > 1e-9 || !sx) {
          warn(pointer, 'skew/singular matrix cannot be represented by Anima transforms');
          continue;
        }
        Object.assign(t, {
          x: e,
          y: f,
          rotate: (Math.atan2(b, a) * 180) / Math.PI,
          scaleX: sx,
          scaleY: (a * d - b * c) / sx,
        });
      } else {
        warn(pointer, 'unsupported transform ' + m[1]);
        continue;
      }
      // collect first; wrapping in reverse below gives T1 * T2 * node
      matches[i] = Object.assign(m, { compiled: t });
    }
    for (let i = matches.length - 1; i >= 0; i--) {
      const t = (matches[i] as unknown as { compiled?: RecordValue }).compiled;
      if (t) node = { id: 'svg-transform-' + serial++, type: 'group', ...t, children: [node] };
    }
    return node;
  }
  function visit(el: Element, pointer: string, inherited: RecordValue): RecordValue[] {
    if (el.name === 'defs') {
      el.children.forEach((child, i) => {
        if (child.kind === 'element' && !['linearGradient', 'radialGradient'].includes(child.name))
          warn(pointer + '/' + i, 'unsupported SVG definition ' + child.name);
      });
      return [];
    }
    if (['title', 'desc', 'metadata'].includes(el.name)) {
      warn(pointer, 'SVG descriptive metadata is not imported');
      return [];
    }
    const a = attrs(el),
      style = { ...inherited };
    const known = new Set([
      'id',
      'transform',
      'opacity',
      'display',
      'visibility',
      'fill',
      'fill-rule',
      'stroke',
      'stroke-width',
      'stroke-linecap',
      'stroke-linejoin',
      'stroke-dasharray',
      'stroke-dashoffset',
    ]);
    for (const k of [
      'fill',
      'fill-rule',
      'stroke',
      'stroke-width',
      'stroke-linecap',
      'stroke-linejoin',
      'stroke-dasharray',
      'stroke-dashoffset',
    ])
      if (a[k] !== undefined) style[k] = a[k];
    const node: RecordValue = { id: 'svg-' + serial++, type: el.name };
    const coordinate = (key: string, fallback = 0) => {
      known.add(key);
      const value = a[key] === undefined ? fallback : Number(a[key]!.replace(/px$/i, ''));
      if (!Number.isFinite(value)) warn(pointer + '/@' + key, 'unsupported SVG coordinate/unit');
      return Number.isFinite(value) ? value : fallback;
    };
    const numeric = (target: string, key: string, fallback = 0) => {
      node[target] = coordinate(key, fallback);
    };
    if (el.name === 'g' || el.name === 'svg') {
      node.type = 'group';
      node.children = el.children.flatMap((c, i) =>
        c.kind === 'element' ? visit(c, pointer + '/' + i, style) : [],
      );
    } else {
      if (el.name === 'path') {
        known.add('d');
        node.d = a.d;
      } else if (el.name === 'rect') {
        numeric('x0', 'x');
        numeric('y0', 'y');
        numeric('w', 'width');
        numeric('h', 'height');
        if (a.rx) numeric('rx', 'rx');
      } else if (el.name === 'circle') {
        known.add('cx');
        known.add('cy');
        node.center = [coordinate('cx'), coordinate('cy')];
        numeric('r', 'r');
      } else if (el.name === 'ellipse') {
        // Painted ellipses take cx/cy, not circle's center pair.
        node.cx = coordinate('cx');
        node.cy = coordinate('cy');
        numeric('rx', 'rx');
        numeric('ry', 'ry');
      } else if (['line', 'polyline', 'polygon'].includes(el.name)) {
        node.type = 'path';
        if (el.name === 'line') {
          for (const k of ['x1', 'y1', 'x2', 'y2']) known.add(k);
          node.d = `M${coordinate('x1')} ${coordinate('y1')}L${coordinate('x2')} ${coordinate('y2')}`;
        } else {
          known.add('points');
          const points = (a.points ?? '').trim().split(/[ ,]+/).map(Number);
          node.d =
            'M' +
            points.slice(0, 2).join(' ') +
            'L' +
            points.slice(2).join(' ') +
            (el.name === 'polygon' ? 'Z' : '');
        }
      } else {
        warn(pointer, 'unsupported SVG element ' + el.name);
        return [];
      }
      const fill = paint(style.fill ?? '#000000', pointer + '/@fill');
      if (fill && el.name !== 'line')
        node.fill = { ...fill, rule: style['fill-rule'] ?? 'nonzero' };
      const stroke = paint(style.stroke ?? 'none', pointer + '/@stroke');
      if (stroke)
        node.stroke = {
          ...stroke,
          width: Number(String(style['stroke-width'] ?? 1).replace(/px$/i, '')),
          cap: style['stroke-linecap'] ?? 'butt',
          join: style['stroke-linejoin'] ?? 'miter',
          ...(style['stroke-dasharray'] && style['stroke-dasharray'] !== 'none'
            ? { dash: style['stroke-dasharray'].split(/[ ,]+/).map(Number) }
            : {}),
          ...(style['stroke-dashoffset'] ? { dashOffset: Number(style['stroke-dashoffset']) } : {}),
        };
      if (node.stroke) {
        for (const [key, allowed, fallback] of [
          ['cap', ['butt', 'round', 'square'], 'butt'],
          ['join', ['miter', 'round', 'bevel'], 'miter'],
        ] as const)
          if (!allowed.includes(node.stroke[key])) {
            warn(pointer + '/@stroke-line' + key, 'unsupported SVG stroke ' + key);
            node.stroke[key] = fallback;
          }
        if (!Number.isFinite(node.stroke.width)) {
          warn(pointer + '/@stroke-width', 'unsupported SVG stroke width');
          node.stroke.width = 1;
        }
        if (node.stroke.dash?.some((v: number) => !Number.isFinite(v))) {
          warn(pointer + '/@stroke-dasharray', 'unsupported SVG dash units');
          delete node.stroke.dash;
        }
      }
      for (const [i, c] of el.children.entries())
        if (c.kind === 'element') warn(pointer + '/' + i, 'unsupported SVG child ' + c.name);
    }
    if (a.opacity !== undefined) {
      const opacity = a.opacity.endsWith('%')
        ? Number(a.opacity.slice(0, -1)) / 100
        : Number(a.opacity);
      if (!Number.isFinite(opacity)) warn(pointer + '/@opacity', 'unsupported SVG opacity');
      node.opacity = Number.isFinite(opacity) ? opacity : 1;
    }
    if (a.display === 'none' || a.visibility === 'hidden') node.visible = false;
    if (el === root)
      for (const k of ['xmlns', 'viewBox', 'width', 'height', 'version']) known.add(k);
    for (const key of Object.keys(a))
      if (!known.has(key)) warn(pointer + '/@' + key, 'unsupported SVG attribute ' + key);
    return [a.transform ? transform(node, a.transform, pointer + '/@transform') : node];
  }
  doc.nodes = visit(root, '/svg', {});
  return { doc, diagnostics };
}
