import { fault, MAX_FONT } from './binary.ts';
import type { Font } from './reader.ts';
import { index, dict, cffOutline } from '../../../../modules/fonts/core/opentype/cff.ts';
export { cffOutline } from '../../../../modules/fonts/core/opentype/cff.ts';
/** CFF1 subsetting with stable glyph IDs. Rebuild offset-bearing dictionaries and INDEXes;
 * preserve charset/encoding/FDSelect and local/global subroutines byte-for-byte.
 */
export function subsetCFF(font: Font, keep: ReadonlySet<number>): Buffer {
  const b = font.table('CFF '),
    names = index(b, b.u8(2)),
    topStart = names.end,
    top = index(b, topStart);
  if (b.u8(0) !== 1 || top.items.length !== 1)
    fault('subsetting requires a single CFF1 font', 'font-unsupported');
  const info = dict(top.items[0]!),
    charStart = info.get(17)?.[0] ?? fault('missing CFF CharStrings'),
    chars = index(b, charStart);
  if (chars.items.length !== font.glyphCount) fault('CFF CharStrings count mismatch');
  if (keep.size === font.glyphCount) return Buffer.from(b.data);
  // Reject implicit seac dependencies; one shared instruction budget bounds the whole operation.
  const budget = { remaining: 4_000_000 };
  for (const glyph of keep) cffOutline(font, glyph, 1, 0, 0, budget);
  const makeIndex = (items: Uint8Array[]): Buffer => {
    if (!items.length) return Buffer.alloc(2);
    if (3 + 4 * (items.length + 1) + items.reduce((sum, item) => sum + item.length, 0) > MAX_FONT)
      fault('CFF INDEX size limit', 'font-limit');
    const h = Buffer.alloc(3 + 4 * (items.length + 1));
    h.writeUInt16BE(items.length);
    h[2] = 4;
    let offset = 1;
    items.forEach((item, i) => {
      h.writeUInt32BE(offset, 3 + i * 4);
      offset += item.length;
    });
    h.writeUInt32BE(offset, 3 + items.length * 4);
    return Buffer.concat([h, ...items]);
  };
  const encodeNumber = (n: number): Buffer => {
    if (Number.isInteger(n) && n >= -2147483648 && n <= 2147483647) {
      const out = Buffer.alloc(5);
      out[0] = 29;
      out.writeInt32BE(n, 1);
      return out;
    }
    if (!Number.isFinite(n)) fault('nonfinite CFF dictionary value');
    const digits: number[] = [];
    const text = String(n).toLowerCase();
    for (let i = 0; i < text.length; i++) {
      const c = text[i]!;
      if (c === 'e') {
        if (text[i + 1] === '-') {
          digits.push(12);
          i++;
        } else {
          digits.push(11);
          if (text[i + 1] === '+') i++;
        }
      } else digits.push(c === '.' ? 10 : c === '-' ? 14 : Number(c));
    }
    digits.push(15);
    if (digits.length & 1) digits.push(15);
    return Buffer.from([
      30,
      ...Array.from(
        { length: digits.length / 2 },
        (_, i) => digits[i * 2]! * 16 + digits[i * 2 + 1]!,
      ),
    ]);
  };
  const encodeDict = (d: Map<number, number[]>): Buffer =>
    Buffer.concat(
      [...d].flatMap(([op, values]) => [
        ...values.map(encodeNumber),
        Buffer.from(op >= 1200 ? [12, op - 1200] : [op]),
      ]),
    );
  type Patch = { start: number; end: number; bytes: Buffer; write?: () => Buffer };
  const patches: Patch[] = [],
    privates = new Map<number, { size: number; patch: Patch; values: Map<number, number[]> }>();
  let relocating = false;
  const relocate = (p: number): number => {
    if (!relocating) return p;
    b.check(p, 0);
    let delta = 0;
    for (const patch of patches) {
      if (p > patch.start && p < patch.end) fault('CFF offset points inside a rewritten structure');
      if (patch.end <= p) delta += patch.bytes.length - (patch.end - patch.start);
    }
    return p + delta;
  };
  const registerPrivate = (entry: number[] | undefined) => {
    if (!entry) return;
    const [size, start] = entry;
    if (size === undefined || start === undefined) fault('invalid CFF Private entry');
    const prior = privates.get(start);
    if (prior) {
      if (prior.size !== size) fault('conflicting CFF private dictionary ranges');
      return;
    }
    const values = dict(b.slice(start, size)),
      patch: Patch = { start, end: start + size, bytes: Buffer.alloc(0) };
    const write = () => {
      const result = new Map(values);
      const subrs = values.get(19);
      if (subrs) result.set(19, [relocate(start + subrs[0]!) - relocate(start)]);
      return encodeDict(result);
    };
    patch.write = write;
    patch.bytes = write();
    privates.set(start, { size, patch, values });
    patches.push(patch);
  };
  registerPrivate(info.get(18));
  const rewritePrivate = (d: Map<number, number[]>): Map<number, number[]> => {
    const result = new Map(d),
      entry = d.get(18);
    if (entry) {
      const privateDict = privates.get(entry[1]!) ?? fault('missing CFF private dictionary');
      result.set(18, [privateDict.patch.bytes.length, relocate(entry[1]!)]);
    }
    return result;
  };
  const fdStart = info.get(1236)?.[0];
  if (fdStart !== undefined) {
    const fds = index(b, fdStart),
      dicts = fds.items.map(dict);
    dicts.forEach((d) => registerPrivate(d.get(18)));
    const write = () => makeIndex(dicts.map((d) => encodeDict(rewritePrivate(d))));
    patches.push({ start: fdStart, end: fds.end, bytes: write(), write });
  }
  const writeTop = () => {
    const result = rewritePrivate(info);
    for (const op of [15, 16, 17, 1236, 1237]) {
      const entry = result.get(op);
      if (entry && !(op === 15 && entry[0]! <= 2) && !(op === 16 && entry[0]! <= 1))
        result.set(op, [relocate(entry[0]!)]);
    }
    return makeIndex([encodeDict(result)]);
  };
  patches.push({ start: topStart, end: top.end, bytes: writeTop(), write: writeTop });
  patches.push({
    start: charStart,
    end: chars.end,
    bytes: makeIndex(chars.items.map((raw, id) => (keep.has(id) ? raw : Buffer.from([14])))),
  });
  patches.sort((a, c) => a.start - c.start);
  for (let i = 1; i < patches.length; i++)
    if (patches[i]!.start < patches[i - 1]!.end) fault('overlapping CFF structures');
  relocating = true;
  for (const patch of patches)
    if (patch.write) {
      const rewritten = patch.write();
      if (rewritten.length !== patch.bytes.length) fault('unstable CFF relocation size');
      patch.bytes = rewritten;
    }
  const chunks: Uint8Array[] = [];
  let p = 0;
  for (const patch of patches) {
    chunks.push(b.slice(p, patch.start - p), patch.bytes);
    p = patch.end;
  }
  chunks.push(b.slice(p, b.data.length - p));
  if (chunks.reduce((sum, chunk) => sum + chunk.length, 0) > MAX_FONT)
    fault('CFF subset size limit', 'font-limit');
  return Buffer.concat(chunks);
}
