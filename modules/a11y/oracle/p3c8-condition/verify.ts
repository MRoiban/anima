// Independent native capture checks; no Anima runtime or adjusted comparison.
import { readFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert/strict';
import { PNG } from 'pngjs';
export const stages = ['child', 'parent', 'first', 'right', 'outside', 'hidden'];
export function markerPixels(name: string): number[] {
  const png = PNG.sync.read(readFileSync(new URL(`frames/${name}.png`, import.meta.url)));
  const xs: number[] = [];
  for (let y = 28; y < 33; y++)
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      if (png.data[i] === 17 && png.data[i + 1] === 17 && png.data[i + 2] === 17) xs.push(x);
    }
  return [Math.min(...xs), Math.max(...xs)];
}
const measured = [];
for (const name of [...stages, 'control']) {
  const pixels = markerPixels(name);
  deepStrictEqual(pixels, name === 'outside' ? [89, 90] : [69, 70]);
  const tree = JSON.parse(readFileSync(new URL(`frames/${name}.json`, import.meta.url), 'utf8'));
  const bounds = tree.roots.find((n: { label: string }) => n.label === 'condition-marker').bounds;
  deepStrictEqual(bounds, { x: name === 'control' ? 89 : 69, y: 29, width: 2, height: 2 });
  measured.push({ name, pixels, semanticBounds: bounds });
}
console.log(JSON.stringify(measured, null, 2));
