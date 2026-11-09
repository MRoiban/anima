// Optional animation authoring syntax. The runtime player is unchanged.
import { VERBOSE, parseEase, ptr } from '@anima-format/core';
import type { Compiler, Kind } from '../../../packages/markup/src/compile.ts';
import type { Element } from '../../../packages/markup/src/xml.ts';
type Json = Record<string, unknown>;
const IS_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const own = (o: Json, k: string, v: unknown) =>
  Object.defineProperty(o, k, { value: v, enumerable: true, configurable: true, writable: true });
function ease(c: Compiler, s: string): string {
  if (c.eases.has(s)) return resolveEase(c, s);
  const m = /^(cubic|elastic)\((.*)\)$/s.exec(s);
  if (!m) return s; // the loader owns bad-ease and reserved diagnostics
  const args = m[2]!.split(',').map((s) => c.num(s.trim()));
  if (args.length !== (m[1] === 'cubic' ? 4 : 2))
    throw new Error(VERBOSE ? 'wrong number of ease arguments' : '');
  return `${m[1]}(${args.join(', ')})`;
}
function resolveEase(c: Compiler, name: string): string {
  if (c.resolved.has(name)) return c.resolved.get(name)!;
  const a = c.eases.get(name)!;
  if (c.resolving.has(name)) {
    c.error('bad-attribute', '', a.valueAt, VERBOSE ? `cyclic ease declaration "${name}"` : '');
    return name;
  }
  c.resolving.add(name);
  const value = c.read(a, 'ease', '');
  c.resolving.delete(name);
  const result = typeof value === 'string' ? value : name;
  c.resolved.set(name, result);
  return result;
}
function condition(s: string): string {
  // Rewrite only between quoted literals (odd split parts), which are values.
  // Replace the word only between terms: an input itself may legally be named "and".
  return s
    .split(/("(?:[^"\\]|\\.)*")/)
    .map((t, i) =>
      i % 2
        ? t
        : t
            .replace(/\s+and\s+|\s*&&\s*/g, ' && ')
            .replace(/\s*(==|!=|<=|>=|<|>)\s*/g, ' $1 ')
            .replace(/!\s+/g, '!')
            .replace(/@after\(\s*([^)]*?)\s*\)/g, '@after($1)'),
    )
    .join('')
    .trim();
}
// Retain source spans without decoding entities a second time.
function text(el: Element): { value: string; offsets: number[] } {
  let value = '';
  const offsets: number[] = [];
  for (const t of el.children) {
    if (t.kind !== 'text') continue;
    const start = offsets.length;
    const raw = t.raw;
    value += t.value;
    // XML has already decoded valid entities. Only reconstruct their source spans here.
    // An index loop, not matchAll per character: compile time is on the perf guard.
    for (let i = 0; i < raw.length;) {
      const e = raw.charCodeAt(i) === 38 ? raw.indexOf(';', i + 1) : -1;
      const n = e > i + 1 ? e - i + 1 : 1;
      const units = n > 1 && t.value.codePointAt(offsets.length - start)! > 0xffff ? 2 : 1;
      for (let j = 0; j < units; j++) offsets.push(t.offsets?.[i] ?? t.at.offset + i);
      i += n;
    }
  }
  return { value, offsets };
}
function frames(
  c: Compiler,
  el: Element,
  p: string,
  keyValue?: (source: string) => string | undefined,
): unknown[] {
  const { value, offsets } = text(el);
  const keys: unknown[][] = [];
  for (const m of value.matchAll(/[^;\r\n]+/g)) {
    const line = m[0];
    const tokens = [...line.matchAll(/"(?:\\.|[^"\\])*"|\S+/g)];
    if (!tokens.length) continue;
    const at = (i: number) => ({
      ...el.at,
      ...(el.at.locate ?? c.xml!.pos)(offsets[m.index + i] ?? el.at.offset),
    });
    const kp = ptr(p, keys.length);
    try {
      if (tokens.length < 2) throw new Error(VERBOSE ? 'expected time value [ease]' : '');
      const time = c.num(tokens[0]![0]);
      const val = keyValue?.(tokens[1]![0]) ?? c.scalar(tokens[1]![0]);
      const key: unknown[] = [time, val];
      c.map.set(kp, at(tokens[0]!.index));
      c.map.set(kp + '/0', at(tokens[0]!.index));
      c.map.set(kp + '/1', at(tokens[1]!.index));
      if (tokens.length > 2) {
        const start = tokens[2]!.index;
        key.push(ease(c, line.slice(start).trim()));
        c.map.set(kp + '/2', at(start));
      }
      keys.push(key);
    } catch (e) {
      c.error(
        'bad-keyframe',
        kp,
        at(tokens[0]!.index),
        VERBOSE ? (e instanceof Error ? e.message : 'invalid keyframe') : '',
      );
    }
  }
  return keys;
}

function collectEases(c: Compiler, el: Element, p: string): void {
  const local = new Set<string>();
  for (const child of el.children) {
    if (child.kind !== 'element' || child.name !== 'ease') continue;
    const n = child.attrs.find((a) => a.name === 'name');
    const curve = child.attrs.find((a) => a.name === 'curve');
    if (!n) continue;
    if (local.has(n.value.trim()) || c.builtins.includes(n.value.trim()))
      c.error(
        'duplicate-name',
        p,
        n.valueAt,
        VERBOSE ? `ease "${n.value}" is already declared or built in` : '',
      );
    else if (curve) c.eases.set(n.value.trim(), curve);
    local.add(n.value.trim());
    c.read(n, 'name', p);
  }
  checkEases(c, local, p);
}
function checkEases(c: Compiler, names: Iterable<string>, p: string): void {
  for (const name of names) {
    if (!c.eases.has(name)) continue;
    const curve = resolveEase(c, name);
    if (typeof parseEase(curve) === 'string' && !c.failed)
      c.error(
        curve.startsWith('spring(') ? 'reserved' : 'bad-attribute',
        p,
        c.eases.get(name)!.valueAt,
        VERBOSE ? (p ? 'invalid ease curve' : `invalid ease curve "${curve}"`) : '',
      );
  }
}
export const animationMarkup = {
  frames,
  collectEases,
  read(c: Compiler, s: string, kind: Kind): unknown {
    switch (kind) {
      case 'set': {
        const o: Json = {};
        for (const pair of s
          ? s.split(/\s+(?=(?:\$[\w-]+:)?\$?[a-zA-Z][\w-]*(?:\.[\w-]+)*=)/)
          : []) {
          const m = /^((?:\$[\w-]+:)?\$?[a-zA-Z][\w-]*(?:\.[\w-]+)*)=(.+)$/.exec(pair);
          if (!m)
            throw new Error(VERBOSE ? 'expected whitespace-separated name=value assignments' : '');
          if (Object.hasOwn(o, m[1]!))
            throw new Error(VERBOSE ? `repeated assignment "${m[1]}"` : '');
          const source = m[2]!.trim();
          own(
            o,
            m[1]!,
            IS_NUMBER.test(source) || /^(true|false)$/.test(source)
              ? c.scalar(source, false)
              : source,
          );
        }
        return o;
      }
      case 'ease':
        return ease(c, s);
      case 'condition':
        return condition(s);
    }
  },
};
