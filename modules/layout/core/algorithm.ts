// Own single-line subset of CSS Flexbox §9; no Rive implementation is used.
export type Box = { x: number; y: number; width: number; height: number };
export type Size = [number, number];
export interface Item {
  id: number;
  size: Size;
  mode: unknown[];
  min: Size;
  max: Size;
  margin: number[];
  align: string;
  baseline: number;
}
export function edges(value: unknown): number[] {
  const v = typeof value === 'number' ? [value] : Array.isArray(value) ? (value as number[]) : [0];
  return [v[0]!, v[1] ?? v[0]!, v[2] ?? v[0]!, v[3] ?? v[1] ?? v[0]!];
}
export const weight = (v: unknown): number =>
  typeof v === 'string' && /^fill(?:\((.+)\))?$/.test(v) ? Number(v.slice(5, -1) || 1) : 0;
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function arrange(
  items: Item[],
  size: Size,
  padding: number[],
  direction: string,
  gap: number,
  justify: string,
  align: string,
): Box[] {
  const a = direction.startsWith('column') ? 1 : 0,
    b = 1 - a;
  const start = [3, 0],
    end = [1, 2];
  const available = size.map((v, k) => Math.max(0, v - padding[start[k]!]! - padding[end[k]!]!));
  const margin = (i: Item, k: number) => i.margin[start[k]!]! + i.margin[end[k]!]!;
  const sizes = items.map((i) => [...i.size] as Size);
  let free = available[a]! - Math.max(0, items.length - 1) * gap;
  let pending = items.map((i, k) => (weight(i.mode[a]) ? k : -1)).filter((k) => k >= 0);
  items.forEach((i, k) => {
    free -= margin(i, a);
    if (!weight(i.mode[a])) free -= sizes[k]![a]!;
  });
  // Freeze bound violations, then redistribute remaining free space among unfrozen fill items.
  while (pending.length) {
    const largest = Math.max(...pending.map((k) => weight(items[k]!.mode[a])));
    const total = pending.reduce((v, k) => v + weight(items[k]!.mode[a]) / largest, 0);
    const proposed = pending.map(
      (k) => Math.max(0, free) * (weight(items[k]!.mode[a]) / largest / total),
    );
    pending.forEach((k, j) => {
      sizes[k]![a] = clamp(proposed[j]!, items[k]!.min[a]!, items[k]!.max[a]!);
    });
    const totalViolation = pending.reduce((sum, k, j) => sum + sizes[k]![a]! - proposed[j]!, 0);
    const frozen = pending.filter((k, j) =>
      totalViolation > 0
        ? sizes[k]![a]! > proposed[j]!
        : totalViolation < 0
          ? sizes[k]![a]! < proposed[j]!
          : true,
    );
    if (!frozen.length) break;
    frozen.forEach((k) => {
      free -= sizes[k]![a]!;
    });
    pending = pending.filter((k) => !frozen.includes(k));
  }
  const baseline = Math.max(
    0,
    ...items.map((i) => ((i.align || align) === 'baseline' ? i.margin[0]! + i.baseline : 0)),
  );
  const rest =
    available[a]! -
    Math.max(0, items.length - 1) * gap -
    items.reduce((s, i, k) => s + margin(i, a) + sizes[k]![a]!, 0);
  let offset = justify === 'end' ? rest : justify === 'center' ? rest / 2 : 0;
  let spacing = gap;
  if (rest > 0 && justify.startsWith('space-')) {
    const n = items.length,
      divisor = justify === 'space-between' ? n - 1 : justify === 'space-around' ? n : n + 1;
    if (divisor > 0) {
      const extra = rest / divisor;
      spacing += extra;
      offset = justify === 'space-around' ? extra / 2 : justify === 'space-evenly' ? extra : 0;
    }
  }
  const reverse = direction.endsWith('reverse');
  return items.map((i, k) => {
    const s = sizes[k]!,
      alignment = i.align || align;
    if (weight(i.mode[b]) || (alignment === 'stretch' && i.mode[b] === undefined))
      s[b] = clamp(Math.max(0, available[b]! - margin(i, b)), i.min[b]!, i.max[b]!);
    const remaining = available[b]! - margin(i, b) - s[b]!;
    const cross =
      alignment === 'end'
        ? remaining
        : alignment === 'center'
          ? remaining / 2
          : alignment === 'baseline' && a === 0
            ? baseline - i.margin[0]! - i.baseline
            : 0;
    const pos = [0, 0];
    pos[a] =
      padding[start[a]!]! +
      (reverse
        ? available[a]! - offset - i.margin[end[a]!]! - s[a]!
        : offset + i.margin[start[a]!]!);
    pos[b] = padding[start[b]!]! + i.margin[start[b]!]! + cross;
    offset += margin(i, a) + s[a]! + spacing;
    return { x: pos[0]!, y: pos[1]!, width: s[0], height: s[1] };
  });
}
