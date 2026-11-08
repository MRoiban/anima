import { VERBOSE as V } from '../../../../packages/core/src/flags.ts';
import { Bytes, fault } from './binary.ts';
import type { Font } from './reader.ts';

export function index(b: Bytes, p: number): { items: Uint8Array[]; end: number } {
  const count = b.u16(p);
  p += 2;
  if (!count) return { items: [], end: p };
  const size = b.u8(p++);
  if (size < 1 || size > 4) fault(V ? 'invalid CFF INDEX offset size' : '');
  const offset = (i: number) => {
    let value = 0;
    for (let j = 0; j < size; j++) value = value * 256 + b.u8(p + i * size + j);
    return value;
  };
  const base = p + (count + 1) * size - 1,
    items: Uint8Array[] = [];
  if (offset(0) !== 1) fault(V ? 'invalid CFF first offset' : '');
  for (let i = 0; i < count; i++) {
    const a = offset(i),
      z = offset(i + 1);
    items.push(b.slice(base + a, z - a));
  }
  return { items, end: base + offset(count) };
}
function number(b: Bytes, c: { p: number }, first: number): number {
  if (first >= 32 && first <= 246) return first - 139;
  if (first >= 247 && first <= 250) return (first - 247) * 256 + b.u8(c.p++) + 108;
  if (first >= 251 && first <= 254) return -(first - 251) * 256 - b.u8(c.p++) - 108;
  if (first === 28) {
    const v = b.i16(c.p);
    c.p += 2;
    return v;
  }
  if (first === 29) {
    const v = b.i32(c.p);
    c.p += 4;
    return v;
  }
  if (first === 255) {
    const v = b.i32(c.p) / 65536;
    c.p += 4;
    return v;
  }
  if (first === 30) {
    let value = '',
      end = false;
    const tokens = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', 'e', 'e-', '', '-', ''];
    while (!end) {
      const byte = b.u8(c.p++);
      for (const n of [byte >> 4, byte & 15]) {
        if (n === 15) {
          end = true;
          break;
        }
        value += tokens[n];
      }
    }
    const v = Number(value);
    if (!Number.isFinite(v)) fault(V ? 'invalid CFF real' : '');
    return v;
  }
  return fault(V ? 'invalid CFF number' : '');
}
export function dict(raw: Uint8Array): Map<number, number[]> {
  const b = new Bytes(raw),
    c = { p: 0 },
    out = new Map<number, number[]>();
  let stack: number[] = [];
  while (c.p < raw.length) {
    const op = b.u8(c.p++);
    if (op >= 28 || op === 30) stack.push(number(b, c, op));
    else {
      out.set(op === 12 ? 1200 + b.u8(c.p++) : op, stack);
      stack = [];
    }
    if (stack.length > 96) fault(V ? 'CFF dictionary stack limit' : '', 'font-limit');
  }
  return out;
}

type CFFData = {
  source: Uint8Array;
  locals: Map<string, Uint8Array[]>;
  fdArray?: Uint8Array[];
  info: Map<number, number[]>;
  charstrings: { items: Uint8Array[]; end: number };
  global: { items: Uint8Array[]; end: number };
};
const cache = new WeakMap<Font, CFFData>();
function cffData(font: Font): CFFData {
  const source = font.tables.get('CFF ') ?? fault(V ? 'missing CFF table' : '');
  const old = cache.get(font);
  if (old?.source === source) return old;
  const b = font.table('CFF ');
  if (b.u8(0) !== 1) fault(V ? 'CFF2 is not supported' : '', 'font-unsupported');
  const names = index(b, b.u8(2)),
    top = index(b, names.end),
    strings = index(b, top.end),
    global = index(b, strings.end);
  if (top.items.length !== 1) fault(V ? 'CFF font sets are not supported' : '', 'font-unsupported');
  const info = dict(top.items[0]!),
    charstrings = index(b, info.get(17)?.[0] ?? fault(V ? 'missing CFF CharStrings' : ''));
  const data: CFFData = { source, info, charstrings, global, locals: new Map() };
  cache.set(font, data);
  return data;
}
/** CFF1 Type 2 charstrings. No library code; operators follow OpenType CFF/Type2. */
export function cffOutline(
  font: Font,
  glyph: number,
  scale: number,
  x0: number,
  y0: number,
  budget = { remaining: 100000 },
): string {
  const data = cffData(font),
    { info, charstrings, global } = data,
    b = font.table('CFF ');
  if (!charstrings.items[glyph]) fault(V ? 'CFF glyph index out of range' : '');
  let privateInfo = info.get(18),
    local: Uint8Array[] = [];
  if (info.has(1230)) {
    // CID-keyed fonts select their private dictionary through FDSelect.
    const fds = (data.fdArray ??= index(
        b,
        info.get(1236)?.[0] ?? fault(V ? 'missing CFF FDArray' : ''),
      ).items),
      select = info.get(1237)?.[0] ?? fault(V ? 'missing CFF FDSelect' : '');
    if (fds.length > 256) fault(V ? 'CFF FDArray limit' : '', 'font-limit');
    let fd = -1;
    if (b.u8(select) === 0) fd = b.u8(select + 1 + glyph);
    else if (b.u8(select) === 3) {
      const n = b.u16(select + 1);
      for (let i = 0; i < n; i++) {
        if (--budget.remaining < 0) fault(V ? 'CFF selection operation limit' : '', 'font-limit');
        const p = select + 3 + i * 3;
        if (glyph >= b.u16(p) && glyph < (i === n - 1 ? b.u16(select + 3 + n * 3) : b.u16(p + 3)))
          fd = b.u8(p + 2);
      }
    } else fault(V ? 'unsupported CFF FDSelect' : '', 'font-unsupported');
    if (!fds[fd]) fault(V ? 'invalid CFF FD index' : '');
    privateInfo = dict(fds[fd]!).get(18);
  }
  if (privateInfo) {
    const [len, off] = privateInfo;
    if (len === undefined || off === undefined) fault(V ? 'invalid CFF private dictionary' : '');
    const key = off + ':' + len,
      cached = data.locals.get(key);
    if (cached) local = cached;
    else {
      budget.remaining -= len;
      if (budget.remaining < 0) fault(V ? 'CFF dictionary operation limit' : '', 'font-limit');
      const d = dict(b.slice(off, len));
      if (d.has(19)) local = index(b, off + d.get(19)![0]!).items;
      data.locals.set(key, local);
    }
  }
  let x = 0,
    y = 0,
    path = '',
    open = false,
    hints = 0;
  const stack: number[] = [];
  const pt = (x: number, y: number) =>
    `${Number((x0 + x * scale).toFixed(6))} ${Number((y0 - y * scale).toFixed(6))}`;
  const close = () => {
    if (open) path += 'Z';
    open = false;
  };
  const move = (dx: number, dy: number) => {
    close();
    x += dx;
    y += dy;
    path += 'M' + pt(x, y);
    open = true;
  };
  const line = (dx: number, dy: number) => {
    x += dx;
    y += dy;
    path += 'L' + pt(x, y);
  };
  const curve = (a: number, c: number, d: number, e: number, f: number, g: number) => {
    path += 'C' + pt(x + a, y + c) + ' ' + pt(x + a + d, y + c + e) + ' ';
    x += a + d + f;
    y += c + e + g;
    path += pt(x, y);
  };
  const execute = (raw: Uint8Array, depth: number): void => {
    if (depth > 16) fault(V ? 'CFF subroutine nesting limit' : '', 'font-limit');
    const r = new Bytes(raw),
      cursor = { p: 0 };
    while (cursor.p < raw.length) {
      if (--budget.remaining < 0) fault(V ? 'CFF instruction limit' : '', 'font-limit');
      const op = r.u8(cursor.p++);
      if (op === 28 || op >= 32) {
        stack.push(number(r, cursor, op));
        if (stack.length > 96) fault(V ? 'CFF operand stack limit' : '', 'font-limit');
        continue;
      }
      if (op === 10 || op === 29) {
        const subrs = op === 10 ? local : global.items,
          index = stack.pop();
        if (index === undefined) fault(V ? 'missing CFF subroutine index' : '');
        const bias = subrs.length < 1240 ? 107 : subrs.length < 33900 ? 1131 : 32768;
        const sub = subrs[index + bias];
        if (!sub) fault(V ? 'invalid CFF subroutine index' : '');
        execute(sub, depth + 1);
        continue;
      }
      if (op === 11) return;
      if (op === 1 || op === 3 || op === 18 || op === 23) {
        if (stack.length % 2) stack.shift();
        hints += stack.length / 2;
        stack.length = 0;
        continue;
      }
      if (op === 19 || op === 20) {
        if (stack.length % 2) stack.shift();
        hints += stack.length / 2;
        stack.length = 0;
        cursor.p += Math.ceil(hints / 8);
        r.check(cursor.p, 0);
        continue;
      }
      if (op === 14) {
        if (stack.length > 1)
          fault(V ? 'CFF seac outlines are not supported' : '', 'font-unsupported');
        stack.length = 0;
        close();
        return;
      }
      if (op === 4 || op === 21 || op === 22) {
        const n = op === 21 ? 2 : 1;
        if (stack.length === n + 1) stack.shift();
        if (stack.length !== n) fault(V ? 'invalid CFF moveto' : '');
        move(op === 4 ? 0 : stack[0]!, op === 22 ? 0 : stack.at(-1)!);
        stack.length = 0;
        continue;
      }
      if (op === 12) {
        const escape = r.u8(cursor.p++),
          s = stack.splice(0);
        if (escape === 34 && s.length === 7) {
          curve(s[0]!, 0, s[1]!, s[2]!, s[3]!, 0);
          curve(s[4]!, 0, s[5]!, -s[2]!, s[6]!, 0);
        } else if (escape === 35 && s.length === 13) {
          curve(...(s.slice(0, 6) as [number, number, number, number, number, number]));
          curve(...(s.slice(6, 12) as [number, number, number, number, number, number]));
        } else if (escape === 36 && s.length === 9) {
          curve(s[0]!, s[1]!, s[2]!, s[3]!, s[4]!, 0);
          curve(s[5]!, 0, s[6]!, s[7]!, s[8]!, -s[1]! - s[3]! - s[7]!);
        } else if (escape === 37 && s.length === 11) {
          const dx = s[0]! + s[2]! + s[4]! + s[6]! + s[8]!,
            dy = s[1]! + s[3]! + s[5]! + s[7]! + s[9]!;
          curve(...(s.slice(0, 6) as [number, number, number, number, number, number]));
          curve(
            s[6]!,
            s[7]!,
            s[8]!,
            s[9]!,
            Math.abs(dx) > Math.abs(dy) ? s[10]! : -dx,
            Math.abs(dx) > Math.abs(dy) ? -dy : s[10]!,
          );
        } else fault('unsupported CFF escaped operator ' + escape, 'font-unsupported');
        continue;
      }
      const s = stack.splice(0);
      let p = 0;
      const take = () => {
        if (p >= s.length) fault(V ? 'invalid CFF operator arity' : '');
        return s[p++]!;
      };
      if (op === 5) {
        while (p < s.length) line(take(), take());
      } else if (op === 6 || op === 7) {
        let horizontal = op === 6;
        while (p < s.length) {
          line(horizontal ? take() : 0, horizontal ? 0 : take());
          horizontal = !horizontal;
        }
      } else if (op === 8) {
        while (p < s.length) curve(take(), take(), take(), take(), take(), take());
      } else if (op === 24) {
        while (s.length - p > 2) curve(take(), take(), take(), take(), take(), take());
        line(take(), take());
      } else if (op === 25) {
        while (s.length - p > 6) line(take(), take());
        curve(take(), take(), take(), take(), take(), take());
      } else if (op === 26 || op === 27) {
        let optional = s.length % 4 ? take() : 0;
        while (p < s.length) {
          if (op === 26) curve(optional, take(), take(), take(), 0, take());
          else curve(take(), optional, take(), take(), take(), 0);
          optional = 0;
        }
      } else if (op === 30 || op === 31) {
        let horizontal = op === 31;
        while (p < s.length) {
          const a = take(),
            c = take(),
            d = take(),
            e = take(),
            last = s.length - p === 1 ? take() : 0;
          if (horizontal) curve(a, 0, c, d, last, e);
          else curve(0, a, c, d, e, last);
          horizontal = !horizontal;
        }
      } else fault('unsupported CFF operator ' + op, 'font-unsupported');
    }
  };
  execute(charstrings.items[glyph]!, 0);
  close();
  return path;
}
