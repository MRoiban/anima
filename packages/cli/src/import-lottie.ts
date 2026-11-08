// Lottie JSON is validated by the generated Anima loader after conversion.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Diagnostic } from '@anima-format/core';
import type { Imported } from './import-svg.ts';
type Obj = Record<string, any>;
export function importLottie(source: string, name: string): Imported {
  const root = JSON.parse(source) as Obj;
  if (!root || typeof root !== 'object' || !Array.isArray(root.layers))
    throw Error('expected a Lottie animation with layers');
  const diagnostics: Diagnostic[] = [];
  const warn = (pointer: string, message: string) =>
    diagnostics.push({
      code: 'import-unsupported',
      severity: 'warning',
      pointer,
      message,
      hint: 'simplify this Lottie feature or author it directly in AniML',
    });
  const keys = (o: Obj, allowed: string[], path: string) => {
    for (const k of Object.keys(o))
      if (!allowed.includes(k)) warn(path + '/' + k, 'unsupported Lottie field ' + k);
  };
  const fr = Number(root.fr),
    ip = Number(root.ip ?? 0),
    op = Number(root.op);
  if (!Number.isFinite(fr) || fr <= 0 || !Number.isFinite(op) || op <= ip)
    throw Error('Lottie needs fr > 0 and op > ip');
  const duration = (op - ip) / fr,
    tracks: Obj = {};
  const doc: Obj = {
    anima: '0.1',
    name,
    grid: Math.max(Number(root.w), Number(root.h)),
    viewBox: [0, 0, Number(root.w), Number(root.h)],
    requires: ['paint'],
    nodes: [],
  };
  keys(root, ['v', 'fr', 'ip', 'op', 'w', 'h', 'nm', 'ddd', 'layers', 'assets', 'markers'], '');
  if (root.ddd) warn('/ddd', '3D composition unsupported');
  for (const key of ['assets', 'markers'])
    if (root[key]?.length) warn('/' + key, 'composition ' + key + ' unsupported');
  let serial = 0;
  const point = (v: any): number[] => (Array.isArray(v) ? v : [v]);
  function ease(k: Obj, index: number): string | undefined {
    if (k.h === 1) return 'hold';
    if (!k.o || !k.i) return;
    const n = (v: any) => Number(Array.isArray(v) ? (v[index] ?? v[0]) : v);
    return `cubic(${n(k.o.x)},${n(k.o.y)},${n(k.i.x)},${n(k.i.y)})`;
  }
  function property(
    node: Obj,
    fields: string[],
    property: Obj | undefined,
    path: string,
    convert: (v: any) => any[] = point,
  ): void {
    if (!property) return;
    if (property.k === undefined) {
      warn(path, 'unsupported property representation');
      return;
    }

    keys(property, ['a', 'k', 'ix', 'l'], path);
    if (property.x !== undefined) warn(path + '/x', 'expressions unsupported');
    const list = property.a === 1 ? property.k : undefined;
    const first = list ? list[0]?.s : property.k;
    const values = convert(first);
    fields.forEach((key, i) => {
      node[key] = values[i];
    });
    if (!list) return;
    fields.forEach((field, i) => {
      const out: any[] = [];
      for (const [j, k] of (list as Obj[]).entries()) {
        keys(k, ['t', 's', 'e', 'i', 'o', 'h'], path + '/k/' + j);
        if (k.to || k.ti) warn(path + '/k/' + j, 'spatial Bezier interpolation unsupported');
        const value = k.s ?? list[j - 1]?.e;
        if (value === undefined) {
          warn(path + '/k/' + j, 'keyframe has no value');
          continue;
        }
        const t = (Number(k.t) - ip) / fr;
        if (t < 0 || t > duration) {
          warn(path + '/k/' + j + '/t', 'keyframe outside composition interval');
          continue;
        }
        const e = ease(k, i);
        out.push(e ? [t, convert(value)[i], e] : [t, convert(value)[i]]);
      }
      if (out.length) tracks[node.id + '.' + field] = out;
    });
  }
  function transform(node: Obj, ks: Obj, path: string): void {
    keys(ks, ['ty', 'nm', 'mn', 'ix', 'a', 'p', 's', 'r', 'rz', 'o', 'sk', 'sa', 'hd'], path);
    const anchor = ks.a?.k;
    if (ks.a?.a === 1) warn(path + '/a', 'animated anchor unsupported');
    const a = Array.isArray(anchor) ? anchor : [0, 0];
    node.pivot = [a[0], a[1]];
    property(node, ['x', 'y'], ks.p, path + '/p', (v) => [
      point(v)[0]! - a[0],
      point(v)[1]! - a[1],
    ]);
    if (ks.p?.s) warn(path + '/p/s', 'separated position unsupported');
    property(node, ['scaleX', 'scaleY'], ks.s, path + '/s', (v) => point(v).map((n) => n / 100));
    property(node, ['rotate'], ks.r ?? ks.rz, path + '/r');
    property(node, ['opacity'], ks.o, path + '/o', (v) => point(v).map((n) => n / 100));
    if (ks.sk?.k || ks.sa?.k) warn(path + '/sk', 'skew transform unsupported');
  }
  const hex = (value: any) =>
    '#' +
    [...point(value).slice(0, 3), point(value)[3] ?? 1]
      .map((n) =>
        Math.round(Math.min(1, Math.max(0, n)) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
  function pathData(value: any): string {
    const p = Array.isArray(value) ? value[0] : value;
    if (!p || !Array.isArray(p.v) || !p.v.length) throw Error('invalid Lottie shape path');
    let d = `M${p.v[0][0]} ${p.v[0][1]}`;
    for (let n = 1; n < p.v.length + (p.c ? 1 : 0); n++) {
      const i = n % p.v.length,
        j = (n - 1) % p.v.length;
      d += `C${p.v[j][0] + p.o[j][0]} ${p.v[j][1] + p.o[j][1]} ${p.v[i][0] + p.i[i][0]} ${p.v[i][1] + p.i[i][1]} ${p.v[i][0]} ${p.v[i][1]}`;
    }
    return d + (p.c ? 'Z' : '');
  }
  function shapes(items: Obj[], path: string): Obj[] {
    const out: Obj[] = [];
    const fills = items.filter((s) => s.ty === 'fl'),
      strokes = items.filter((s) => s.ty === 'st');
    if (fills.length > 1 || strokes.length > 1)
      warn(
        path,
        'multiple fills/strokes unsupported; only the final paint of each kind is imported',
      );
    for (const [index, s] of items.entries()) {
      const p = path + '/' + index,
        node: Obj = { id: 'lottie-' + serial++, type: 'path' };
      if (s.bm) warn(p + '/bm', 'shape blend mode unsupported');
      if (s.hd) {
        warn(p + '/hd', 'hidden shape omitted');
        continue;
      }
      if (s.ty === 'gr') {
        keys(s, ['ty', 'nm', 'mn', 'ix', 'it', 'np', 'cix', 'bm', 'hd'], p);
        node.type = 'group';
        node.children = shapes(s.it ?? [], p + '/it');
        const tr = s.it?.find((v: Obj) => v.ty === 'tr');
        if (tr) transform(node, tr, p + '/it/' + s.it.indexOf(tr));
      } else if (s.ty === 'rc' || s.ty === 'el') {
        keys(s, ['ty', 'nm', 'mn', 'ix', 'p', 's', 'r', 'd', 'hd'], p);
        const size = point(s.s?.k),
          pos = point(s.p?.k);
        if (s.s?.a || s.p?.a) {
          warn(p, 'animated primitive size/position unsupported; initial values imported');
        }
        if (!size.every(Number.isFinite) || !pos.every(Number.isFinite)) {
          warn(p, 'animated primitive omitted');
          continue;
        }
        if (s.r?.a === 1)
          warn(p + '/r', 'animated primitive rounding unsupported; initial value imported');
        if (s.ty === 'rc')
          Object.assign(node, {
            type: 'rect',
            x0: pos[0]! - size[0]! / 2,
            y0: pos[1]! - size[1]! / 2,
            w: size[0],
            h: size[1],
            rx: s.r?.a === 1 ? Number(s.r.k?.[0]?.s?.[0] ?? 0) : (s.r?.k ?? 0),
          });
        else
          Object.assign(node, {
            type: 'ellipse',
            cx: pos[0],
            cy: pos[1],
            rx: size[0]! / 2,
            ry: size[1]! / 2,
          });
      } else if (s.ty === 'sh') {
        keys(s, ['ty', 'nm', 'mn', 'ix', 'ks', 'ind', 'hd'], p);
        property(node, ['d'], s.ks, p + '/ks', (v) => [pathData(v)]);
      } else if (['fl', 'st', 'tm', 'tr'].includes(s.ty)) continue;
      else {
        warn(p, 'unsupported Lottie shape ' + s.ty);
        continue;
      }
      if (node.type !== 'group') {
        for (const [kind, list] of [
          ['fill', fills],
          ['stroke', strokes],
        ] as const) {
          const paint = list.at(-1);
          if (!paint) continue;
          const pp = path + '/' + items.indexOf(paint);
          keys(
            paint,
            ['ty', 'nm', 'mn', 'ix', 'c', 'o', 'r', 'w', 'lc', 'lj', 'ml', 'bm', 'd', 'hd'],
            pp,
          );
          const target: Obj = { id: node.id };
          property(target, [kind + '.color'], paint.c, pp + '/c', (v) => [hex(v)]);
          const c = target[kind + '.color'];
          node[kind] = { color: c };
          if (paint.o?.a || (paint.o?.k ?? 100) !== 100)
            warn(pp + '/o', 'paint opacity unsupported');
          if (kind === 'fill') node.fill.rule = paint.r === 2 ? 'evenodd' : 'nonzero';
          else {
            property(target, ['stroke.width'], paint.w, pp + '/w');
            node.stroke.width = target['stroke.width'] ?? 1;
            node.stroke.cap = ['butt', 'round', 'square'][(paint.lc ?? 1) - 1];
            node.stroke.join = ['miter', 'round', 'bevel'][(paint.lj ?? 1) - 1];
            if (paint.d?.length) warn(pp + '/d', 'stroke dashes unsupported');
          }
        }
        const trim = items.find((v) => v.ty === 'tm');
        if (trim) {
          const pp = path + '/' + items.indexOf(trim);
          keys(trim, ['ty', 'nm', 'mn', 'ix', 's', 'e', 'o', 'm', 'hd'], pp);
          if (!node.stroke) warn(pp, 'trim paths on filled geometry unsupported');
          else {
            const t: Obj = { id: node.id };
            for (const [key, field, div] of [
              ['s', 'trimStart', 100],
              ['e', 'trimEnd', 100],
              ['o', 'trimOffset', 360],
            ] as const) {
              property(t, ['stroke.' + field], trim[key], pp + '/' + key, (v) =>
                point(v).map((n) => n / div),
              );
              node.stroke[field] = t['stroke.' + field] ?? (key === 'e' ? 1 : 0);
            }
          }
          if (trim.m === 2) warn(pp + '/m', 'individual trim paths unsupported');
        }
      }
      out.push(node);
    }
    return out;
  }
  // Lottie paints later layer entries behind earlier entries; Anima draws forward.
  root.layers.forEach((layer: Obj, index: number) => {
    const p = '/layers/' + index;
    keys(
      layer,
      [
        'ddd',
        'ind',
        'ty',
        'nm',
        'sr',
        'ks',
        'ao',
        'shapes',
        'ip',
        'op',
        'st',
        'bm',
        'parent',
        'hd',
      ],
      p,
    );
    if (layer.ty !== 4) {
      warn(p + '/ty', 'only shape layers are supported');
      return;
    }
    for (const key of ['parent', 'ao', 'bm', 'ddd'])
      if (key === 'parent' ? layer[key] !== undefined : layer[key])
        warn(p + '/' + key, 'unsupported layer ' + key);
    if ((layer.sr ?? 1) !== 1 || (layer.st ?? 0) !== 0)
      warn(p + ((layer.sr ?? 1) !== 1 ? '/sr' : '/st'), 'layer time remapping unsupported');
    if ((layer.ip ?? ip) !== ip || (layer.op ?? op) !== op)
      warn(
        p + ((layer.ip ?? ip) !== ip ? '/ip' : '/op'),
        'partial layer visibility interval unsupported',
      );
    const node: Obj = {
      id: 'layer-' + index,
      type: 'group',
      children: shapes(layer.shapes ?? [], p + '/shapes'),
    };
    if (layer.hd) node.visible = false;
    transform(node, layer.ks ?? {}, p + '/ks');
    doc.nodes.unshift(node);
  });
  if (Object.keys(tracks).length) {
    doc.timelines = { imported: { duration, tracks } };
    doc.machine = { layers: { main: { initial: 'play', states: { play: { play: 'imported' } } } } };
  }
  return { doc, diagnostics };
}
