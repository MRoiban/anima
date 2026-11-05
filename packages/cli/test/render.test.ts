import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { compareSVG } from '../src/render.ts';

const svg = (fill: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="4" viewBox="0 0 2 1" color="red" style="color:blue"><rect width="1" height="1" fill="${fill}"/></svg>`;

describe('source SVG comparison', () => {
  it('normalizes nonsquare viewport dimensions and existing root ink settings', () => {
    const expected = svg('#000').replace('width="8" height="4"', 'width="64" height="64"');
    expect(compareSVG(svg('currentColor'), expected, 16)).toMatchObject({
      pass: true,
      differingPixels: 0,
    });
  });
  it('counts raw differences separately from tolerance and writes actual channel differences', () => {
    const result = compareSVG(svg('#000'), svg('#010101'), 16, 1, true);
    expect(result.pass).toBe(true);
    expect(result.maxChannelDifference).toBe(1);
    expect(result.differingPixels).toBeGreaterThan(0);
    expect(result.pixelsBeyondTolerance).toBe(0);
    expect(compareSVG(svg('#000'), svg('#010101'), 16).pass).toBe(false);
    const img = new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><image width="16" height="16" href="data:image/png;base64,${result.diff!.toString('base64')}"/></svg>`,
    ).render();
    expect(img.pixels.some((v, i) => i % 4 !== 3 && v === 1)).toBe(true);
    expect(img.pixels.every((v, i) => i % 4 === 3 || v <= 1)).toBe(true);
  });
});
