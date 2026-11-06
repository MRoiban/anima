// `anima render`: single frames and labelled contact sheets, as SVG or PNG.

import { type Paint, type Player, staticSlots, toSVG } from '@anima-format/core';
import { Resvg } from '@resvg/resvg-js';

export interface Look {
  paint: Paint;
  /** CSS colour `currentColor` resolves to. */
  color: string;
  background?: string;
}

/** The fixture convention for comparing with the Rive frames: ink #f0eee6 on #1d1d1d. */
export const DARK: Look = { paint: staticSlots(), color: '#f0eee6', background: '#1d1d1d' };
export const LIGHT: Look = { paint: staticSlots(), color: '#141413' };

/** One frame as a standalone SVG. */
export function frameSVG(p: Player, look: Look, size?: number, id = 'a'): string {
  const svg = toSVG(p, {
    staticLengths: true,
    paint: look.paint,
    background: look.background,
    width: size,
    height: size,
    id,
  });
  return svg.replace('<svg ', `<svg color="${look.color}" `);
}

/** A labelled grid of frames: `frames` are [label, svg] pairs (SVGs from `frameSVG` without a size). */
export function sheetSVG(frames: [string, string][], look: Look, cell = 160): string {
  const cols = Math.min(frames.length, Math.ceil(Math.sqrt(frames.length * 1.5)));
  const rows = Math.ceil(frames.length / cols);
  const label = 18;
  const w = cols * cell;
  const h = rows * (cell + label);
  const fg = look.background ? look.color : '#141413';
  const cells = frames
    .map(([text, svg], k) => {
      const x = (k % cols) * cell;
      const y = Math.floor(k / cols) * (cell + label);
      const inner = svg.replace(
        '<svg ',
        `<svg x="${x}" y="${y}" width="${cell}" height="${cell}" `,
      );
      return `${inner}<text x="${x + cell / 2}" y="${y + cell + 13}" text-anchor="middle" font-family="monospace" font-size="12" fill="${fg}">${text}</text>`;
    })
    .join('');
  const bg = look.background ?? '#ffffff';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${cells}</svg>`;
}

// resvg implements SVG's optimizeSpeed token, not the CSS pixelated token used by browsers.
const rasterSVG = (svg: string) =>
  svg.replaceAll('image-rendering="pixelated"', 'image-rendering="optimizeSpeed"');
export function toPNG(svg: string, width?: number): Buffer {
  return new Resvg(rasterSVG(svg), {
    fitTo: width ? { mode: 'width', value: width } : { mode: 'original' },
    font: { loadSystemFonts: true },
  })
    .render()
    .asPng();
}

/** Decoded RGBA pixels, for pixel comparisons. */
export function pixels(svg: string, width: number): Uint8Array {
  const img = new Resvg(rasterSVG(svg), { fitTo: { mode: 'width', value: width } }).render();
  return img.pixels;
}

/** Normalize viewport and ink before rasterizing both documents with the PNG renderer. */
function comparisonSVG(svg: string, size: number): string {
  return svg.replace(/<svg\b([^>]*)>/i, (_, attrs: string) => {
    let root = attrs.replace(/\s(?:width|height|color)\s*=\s*("[^"]*"|'[^']*')/gi, '');
    let style = '';
    root = root.replace(/\sstyle\s*=\s*(["'])(.*?)\1/gi, (_, _quote: string, value: string) => {
      style = value;
      return '';
    });
    return `<svg${root} width="${size}" height="${size}" color="#000" style="${style};color:#000!important;width:${size}px!important;height:${size}px!important">`;
  });
}

/** Absolute RGBA differences; a diff image shows the largest channel delta as grayscale. */
export function compareSVG(a: string, b: string, size: number, tolerance = 0, diff = false) {
  const left = pixels(comparisonSVG(a, size), size);
  const right = pixels(comparisonSVG(b, size), size);
  if (left.length !== size * size * 4 || right.length !== left.length)
    throw new Error('comparison raster dimensions do not match');
  let differingPixels = 0,
    maxChannelDifference = 0,
    pixelsBeyondTolerance = 0;
  const rects: string[] = [];
  for (let y = 0; y < size; y++) {
    let run = 0,
      previous = -1;
    const flush = (end: number) => {
      if (previous > 0)
        rects.push(
          `<rect x="${run}" y="${y}" width="${end - run}" height="1" fill="rgb(${previous},${previous},${previous})"/>`,
        );
    };
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let delta = 0;
      for (let c = 0; c < 4; c++) delta = Math.max(delta, Math.abs(left[i + c]! - right[i + c]!));
      if (delta) differingPixels++;
      if (delta > tolerance) pixelsBeyondTolerance++;
      maxChannelDifference = Math.max(maxChannelDifference, delta);
      if (diff && delta !== previous) {
        flush(x);
        run = x;
        previous = delta;
      }
    }
    if (diff) flush(size);
  }
  return {
    differingPixels,
    maxChannelDifference,
    pixelsBeyondTolerance,
    pass: pixelsBeyondTolerance === 0,
    ...(diff
      ? {
          diff: toPNG(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="black"/>${rects.join('')}</svg>`,
          ),
        }
      : {}),
  };
}
