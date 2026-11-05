/** A colour as non-premultiplied sRGB channels 0..255: [r, g, b, a]. */
export type RGBA = [number, number, number, number];

/** Parse `#rgb`, `#rrggbb` or `#rrggbbaa` (spec §6). Returns null otherwise. */
export function parseHex(s: string): RGBA | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.replace(/./g, '$&$&');
  if (h.length === 6) h += 'ff';
  return [0, 2, 4, 6].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGBA;
}

/** Canonical lowercase hex: `#rrggbb`, or `#rrggbbaa` when not opaque. */
export function formatHex(c: RGBA): string {
  const hex = (v: number) => v.toString(16).padStart(2, '0');
  return '#' + hex(c[0]) + hex(c[1]) + hex(c[2]) + (c[3] === 255 ? '' : hex(c[3]));
}

/** Spec §5: per channel, `floor(c + 0.5)`, clamped to 0..255. */
export function lerpColor(a: RGBA, b: RGBA, w: number): RGBA {
  return a.map((v, i) => Math.min(255, Math.max(0, Math.floor(v + (b[i]! - v) * w + 0.5)))) as RGBA;
}
