/// <reference lib="dom" />
import { ImageEncoder } from '../encode.ts';
import { sfnt, fault } from './binary.ts';
import type { ToolMeasurer } from './measure.ts';

/** Browser shaping is an explicit rendering choice; same lazy Chromium as image encoding. */
export async function browserTextPNG(svg: string, measurer: ToolMeasurer): Promise<Buffer> {
  const session = new ImageEncoder();
  try {
    const browser = await session.browser(),
      page = await browser.newPage();
    try {
      const fonts = [...measurer.fonts].flatMap(([family, entries]) =>
        entries.map(({ font, weight, style }) => ({
          family,
          weight: font.axes.some((a) => a.tag === 'wght')
            ? font.axes.filter((a) => a.tag === 'wght').map((a) => `${a.min} ${a.max}`)[0]!
            : String(weight),
          style,
          source:
            'data:font/' +
            (font.flavor === 0x4f54544f ? 'otf' : 'ttf') +
            ';base64,' +
            sfnt(font.tables, font.flavor).toString('base64'),
        })),
      );
      await page.setContent(
        '<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>' +
          svg,
      );
      await page.evaluate(async (fonts) => {
        for (const f of fonts) {
          const face = new FontFace(f.family, `url("${f.source}")`, {
            weight: String(f.weight),
            style: f.style,
          });
          document.fonts.add(await face.load());
        }
        await document.fonts.ready;
      }, fonts);
      return await page.locator('svg').first().screenshot({ omitBackground: true });
    } finally {
      await page.close();
    }
  } catch (error) {
    if (error instanceof Error && 'code' in error) throw error;
    fault(
      'cannot render browser text: ' + (error instanceof Error ? error.message : 'browser failure'),
      'font-invalid',
    );
  } finally {
    await session.close();
  }
}

export function embedFontCSS(svg: string, measurer: ToolMeasurer): string {
  const css = [...measurer.fonts]
    .flatMap(([family, entries]) =>
      entries.map(
        ({ font, weight, style }) =>
          `@font-face{font-family:${JSON.stringify(family).replaceAll('<', '\\3c ')};font-weight:${font.axes.find((a) => a.tag === 'wght') ? `${font.axes.find((a) => a.tag === 'wght')!.min} ${font.axes.find((a) => a.tag === 'wght')!.max}` : weight};font-style:${style};src:url(data:font/${font.flavor === 0x4f54544f ? 'otf' : 'ttf'};base64,${sfnt(font.tables, font.flavor).toString('base64')})}`,
      ),
    )
    .join('');
  return svg.replace(/(<svg\b[^>]*>)/, (_match, root: string) => `${root}<style>${css}</style>`);
}
