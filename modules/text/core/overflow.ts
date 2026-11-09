import type { LayoutInput, TextLayout } from './layout.ts';
export type UnalignedTextLayout = TextLayout & { topTrim: number };
export type TextOverflow = (
  input: LayoutInput,
  out: UnalignedTextLayout,
  build: (factor: number) => UnalignedTextLayout,
  limit: number,
  boxHeight: number,
  measure: typeof import('./measure.ts').measure,
) => UnalignedTextLayout;
/** Optional overflow policies; the original layout builder owns measurement and rewrapping. */
export const overflowText: TextOverflow = (input, out, build, limit, boxHeight, measure) => {
  const fitting = input.overflow === 'fit-font-size';
  const fitHeight = (l: TextLayout & { topTrim: number }) =>
    input.fitFromBaseline ? l.contentHeight - l.lines[0]!.baseline + l.topTrim : l.contentHeight;
  const ratio = (box: number, content: number) => (content > 0 ? box / content : 1);
  const zero = !limit || !boxHeight;
  let lo = +!zero;
  if (fitting && lo && (out.contentWidth > limit || fitHeight(out) > boxHeight)) {
    let hi = 1;
    lo = 0;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2,
        test = build(mid);
      if (test.contentWidth <= limit && fitHeight(test) <= boxHeight) lo = mid;
      else hi = mid;
    }
    // No candidate fits: report the empty result rather than measuring size zero.
    if (lo) out = build(lo);
  }
  if (fitting && !lo) {
    out.lines = [];
    out.contentWidth = out.contentHeight = out.fittedSize = 0;
  }
  if (input.overflow === 'fit') {
    out.scale = zero
      ? 0
      : Math.min(1, ratio(limit, out.contentWidth), ratio(boxHeight, fitHeight(out)));
    if (!out.scale) out.lines = [];
  }
  if (fitting && input.fitFontSizeResizesBox) {
    out.width = out.contentWidth;
    out.height = out.contentHeight;
  }
  if (input.overflow === 'hidden' || input.overflow === 'ellipsis') {
    const all = out.lines;
    out.lines = all.filter((l) => l.baseline - out.topTrim + l.descent <= boxHeight);
    if (input.overflow === 'ellipsis') {
      const line = out.lines.at(-1);
      if (line && (out.lines.length < all.length || line.width > limit)) {
        const last = line.clusters.at(-1);
        if (last) {
          const advance = measure(last.font, '…').advances[0] ?? 0;
          while (
            line.clusters.length &&
            line.clusters.at(-1)!.x +
              line.clusters.at(-1)!.advance +
              line.clusters.at(-1)!.font.tracking +
              advance >
              limit
          )
            line.clusters.pop();
          const tail = line.clusters.at(-1),
            x = tail ? tail.x + tail.advance + tail.font.tracking : 0;
          if (advance <= limit)
            line.clusters.push({
              ...last,
              text: '…',
              index: tail ? tail.index + tail.text.length : last.index,
              x,
              advance,
            });
          line.width = advance <= limit ? x + advance : 0;
        }
      }
    }
  }
  return out;
};
