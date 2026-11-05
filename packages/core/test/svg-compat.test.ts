// Captured from b7b6e92 before the draw-layer refactor. These hashes pin bytes, not pixels.
import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { it, expect } from 'vitest';
import { load, Player, toSVG } from '../src/index.ts';
const baseline = {
  'bell.ani': 'b24cfbf81280e5ea5e486acb7c5a0e34b4f62df270cc5f3a2b7bdc312536c496',
  'moon.ani': '4508fee05746c50a8507715893e5039d06e791ec6ce505d5f63d701fb9c6661a',
  'trash.ani': '0e357d77f0ad0f48ddd27ce2446eb4daf9b8f9cf144d5237228031e66869c765',
};
it.each(Object.entries(baseline))(
  'keeps 0.1 %s SVG bytes at rest and three stepped times',
  (name, hash) => {
    const p = new Player(
      load(readFileSync(new URL('../../../examples/' + name, import.meta.url), 'utf8')).model!,
    );
    const frames: string[] = [];
    for (const dt of [0, 0.1, 0.5, 1]) {
      if (dt) p.step(dt);
      frames.push(toSVG(p), toSVG(p, { staticLengths: true }));
    }
    expect(createHash('sha256').update(JSON.stringify(frames)).digest('hex')).toBe(hash);
  },
);
