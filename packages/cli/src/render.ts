import { compareRGBA } from './compare-png.ts';
// `anima render`: single frames and labelled contact sheets, as SVG or PNG.

import { type Paint, type Player, staticSlots } from '@anima-format/core';
// seam(P8-5): tooling-only mesh serializer; browser SVG remains undeformed.
import { toSVG } from '../../../modules/mesh/core/static.ts';
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
    meshTriangles: true,
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
export function comparisonSVG(svg: string, size: number): string {
  // The root element follows the prolog (declaration, comments, PIs, doctype); it may be prefixed.
  const prolog = /^(?:\s+|<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE(?:[^[>]|\[[\s\S]*?\])*>)*/i.exec(
    svg,
  )![0];
  const root = svg
    .slice(prolog.length)
    .replace(
      /^<((?:[\w.-]+:)?svg)\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/i,
      (_, name: string, attrs: string, end: string) => {
        let style = '';
        const own: Record<string, string> = {};
        // Whole attributes only, so attribute-like text inside a value stays text.
        const kept = (attrs.trimEnd().match(/\s+[^\s=]+\s*=\s*(?:"[^"]*"|'[^']*')/g) ?? []).filter(
          (a) => {
            const [, key, value] = /^\s+([^\s=]+)\s*=\s*["']([\s\S]*)["']$/.exec(a)!;
            own[key!] = value!;
            if (/^style$/i.test(key!)) style = value!.replaceAll('"', '&quot;');
            return !/^(?:width|height|color|style)$/i.test(key!);
          },
        );
        // Without a viewBox the intrinsic size is the user space; keep it so the content scales.
        const [w, h] = [own.width, own.height].map((v) => {
          const n = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(?:px)?\s*$/i.exec(v ?? '');
          return n && Number(n[1]) > 0 && Number.isFinite(Number(n[1])) ? Number(n[1]) : 0;
        });
        if (!('viewBox' in own) && w && h) kept.push(` viewBox="0 0 ${w} ${h}"`);
        return `<${name}${kept.join('')} width="${size}" height="${size}" color="#000" style="${style};color:#000!important;width:${size}px!important;height:${size}px!important"${end}>`;
      },
    );
  return prolog + root;
}

/** Absolute RGBA differences; a diff image shows the largest channel delta as grayscale. */
export function compareSVG(a: string, b: string, size: number, tolerance = 0, diff = false) {
  const left = pixels(comparisonSVG(a, size), size);
  const right = pixels(comparisonSVG(b, size), size);
  return compareRGBA(left, right, size, size, tolerance, diff);
}
