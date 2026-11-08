// A small JSON scanner that records where each value starts (by JSON pointer) and finds duplicate
// keys, which JSON.parse silently drops. Only runs on text JSON.parse already accepted.

export interface Located {
  /** Pointer → offset of the value (for keys: of the key's value). */
  at: Map<string, number>;
  duplicates: { pointer: string; offset: number }[];
}

const esc = (k: string) => k.replace(/~/g, '~0').replace(/\//g, '~1');

export function locate(text: string): Located {
  const at = new Map<string, number>();
  const duplicates: Located['duplicates'] = [];
  let i = 0;
  const ws = () => {
    while (/\s/.test(text[i] ?? '')) i++;
  };
  const str = (): string => {
    const start = i;
    i++;
    while (text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
    i++;
    return JSON.parse(text.slice(start, i)) as string;
  };
  // Iterative, so deeply nested values (which load accepts in free-form metadata) cannot overflow
  // the stack and silently skip the duplicate-key check.
  const open: { p: string; seen?: Set<string>; n: number }[] = [];
  const next = (f: (typeof open)[number]): string => {
    if (!f.seen) return `${f.p}/${f.n++}`;
    ws();
    const keyAt = i;
    const k = str();
    const kp = `${f.p}/${esc(k)}`;
    if (f.seen.has(k)) duplicates.push({ pointer: kp, offset: keyAt });
    f.seen.add(k);
    ws();
    i++; // :
    return kp;
  };
  let p = '';
  for (;;) {
    ws();
    at.set(p, i);
    const c = text[i];
    if (c === '{' || c === '[') {
      i++;
      ws();
      if (text[i] === (c === '{' ? '}' : ']')) i++;
      else {
        const f = { p, seen: c === '{' ? new Set<string>() : undefined, n: 0 };
        open.push(f);
        p = next(f);
        continue;
      }
    } else if (c === '"') str();
    else while (i < text.length && !/[\s,\]}]/.test(text[i]!)) i++;
    // The value ended: close finished containers, then continue with the next member.
    for (;;) {
      const f = open.at(-1);
      if (!f) return { at, duplicates };
      ws();
      if (text[i++] !== ',') open.pop();
      else {
        p = next(f);
        break;
      }
    }
  }
}

/** 1-based line and column of an offset. */
export function lineCol(text: string, offset: number): [number, number] {
  const before = text.slice(0, offset);
  const line = before.split('\n').length;
  return [line, offset - before.lastIndexOf('\n')];
}

// JSON strings may not contain raw control characters, so the class names them.
// eslint-disable-next-line no-control-regex
const STRING = /"(?:[^"\\\u0000-\u001f]|\\["\\/bfnrt]|\\u[0-9a-fA-F]{4})*"/y;

/** Offset of the first JSON syntax error, or null if the text is JSON (RFC 8259). */
export function syntaxErrorAt(text: string): number | null {
  let i = 0;
  const fail = () => {
    throw i;
  };
  const ws = () => {
    while (/[ \t\n\r]/.test(text[i] ?? '')) i++;
  };
  const lit = (re: RegExp) => {
    re.lastIndex = i;
    if (!re.test(text)) fail();
    i = re.lastIndex;
  };
  const value = (depth: number): void => {
    if (depth > 512) fail();
    ws();
    const c = text[i];
    if (c === '{' || c === '[') {
      const close = c === '{' ? '}' : ']';
      i++;
      ws();
      if (text[i] === close) return void i++;
      for (;;) {
        if (c === '{') {
          ws();
          if (text[i] !== '"') fail();
          lit(STRING);
          ws();
          if (text[i] !== ':') fail();
          i++;
        }
        value(depth + 1);
        ws();
        if (text[i] === ',') i++;
        else if (text[i] === close) return void i++;
        else fail();
      }
    }
    if (c === '"') return lit(STRING);
    if (c === 't' || c === 'f' || c === 'n') return lit(/true|false|null/y);
    lit(/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?/y);
  };
  try {
    value(0);
    ws();
    return i < text.length ? i : null;
  } catch (at) {
    return at as number;
  }
}
