// Renders bell.ani at the moments of fixtures/bell/rive-reference/frames/commands.txt and puts each
// frame beside the Rive one, with a per-frame pixel difference. Used by tests and by
// `node packages/cli/src/compare.ts <out.png>` for a look.

import { readFileSync, writeFileSync } from 'node:fs';
import { load, type Player } from '@anima-format/core';
import { Resvg } from '@resvg/resvg-js';
import { DARK, frameSVG, toPNG } from './render.ts';

const ROOT = new URL('../../../', import.meta.url);

/** Our script for each Rive frame (Rive pointer (120, 120) px = glyph (10, 10)). */
export const RIVE_STEPS: [frame: string, run: (p: Player) => void][] = [
  ['00-rest', (p) => p.step(1)],
  [
    '01-hover',
    (p) => {
      p.pointer('move', 10, 10);
      p.step(0);
      p.step(0.3);
    },
  ],
  [
    '02-ring-f3',
    (p) => {
      p.pointer('down', 10, 10);
      p.step(0);
      p.pointer('up', 10, 10);
      p.step(0);
      p.step(0.05);
    },
  ],
  ['03-ring-f7', (p) => p.step(0.067)],
  ['04-ring-f17', (p) => p.step(0.167)],
  ['05-ring-f27', (p) => p.step(0.167)],
  ['06-ring-f57', (p) => p.step(0.5)],
  ['07-rested', (p) => p.step(0.7)],
  [
    '08-out',
    (p) => {
      p.pointer('leave');
      p.step(0);
      p.step(0.4);
    },
  ],
];

const SIZE = 240;

/** [frame, our SVG, mean absolute RGB difference 0..255 against Rive's PNG]. */
export async function compareWithRive(): Promise<[string, string, number][]> {
  const { Player } = await import('@anima-format/core');
  const model = load(readFileSync(new URL('examples/bell.ani', ROOT), 'utf8')).model!;
  const p = new Player(model);
  const out: [string, string, number][] = [];
  for (const [frame, run] of RIVE_STEPS) {
    run(p);
    const svg = frameSVG(p, DARK, SIZE);
    const ours = new Resvg(svg).render().pixels;
    const rivePng = readFileSync(new URL(`fixtures/bell/rive-reference/frames/${frame}.png`, ROOT));
    const theirs = new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><image width="${SIZE}" height="${SIZE}" href="data:image/png;base64,${rivePng.toString('base64')}"/></svg>`,
    ).render().pixels;
    let sum = 0;
    for (let i = 0; i < ours.length; i += 4)
      for (let c = 0; c < 3; c++) sum += Math.abs(ours[i + c]! - theirs[i + c]!);
    out.push([frame, svg, sum / ((ours.length / 4) * 3)]);
  }
  return out;
}

/** A sheet: Rive on top, Anima below, one column per frame. */
export async function comparisonSheet(): Promise<string> {
  const rows = await compareWithRive();
  const w = SIZE * rows.length;
  const cells = rows.map(([frame, svg, diff], k) => {
    const png = readFileSync(
      new URL(`fixtures/bell/rive-reference/frames/${frame}.png`, ROOT),
    ).toString('base64');
    const x = k * SIZE;
    return (
      `<image x="${x}" y="20" width="${SIZE}" height="${SIZE}" href="data:image/png;base64,${png}"/>` +
      svg.replace('<svg ', `<svg x="${x}" y="${SIZE + 20}" `) +
      `<text x="${x + SIZE / 2}" y="14" text-anchor="middle" font-family="monospace" font-size="12" fill="#f0eee6">${frame} Δ${diff.toFixed(2)}</text>`
    );
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${2 * SIZE + 20}"><rect width="${w}" height="${2 * SIZE + 20}" fill="#000"/>${cells.join('')}</svg>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] ?? 'compare.png';
  writeFileSync(out, toPNG(await comparisonSheet()));
  for (const [f, , d] of await compareWithRive())
    console.log(`${f}: mean |Δ| ${d.toFixed(2)} / 255`);
  console.log(`wrote ${out}`);
}
