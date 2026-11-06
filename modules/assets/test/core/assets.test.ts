import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { load, Player, drawFrame, toSVG } from '../../../../packages/core/src/index.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
import { fits, aligns } from '../../core/index.ts';
const source = readFileSync(new URL('../../../../examples/photo.animl', import.meta.url), 'utf8');
const doc = () => JSON.parse(compile(source).text!);
describe('assets', () => {
  it('round trips asset declarations and image attributes', () => {
    const d = doc();
    expect(compile(decompile(d)).doc).toEqual(d);
    for (const type of ['font', 'audio', 'blob']) {
      d.assets[type] = {
        type,
        source: './' + type,
        storage: 'referenced',
      };
    }
    expect(load(d).model).toBeDefined();
  });
  it.each([
    [
      'unknown-asset',
      '/nodes/0/asset',
      (d: ReturnType<typeof doc>) => {
        d.nodes[0].asset = 'missing';
      },
    ],
    [
      'asset-type',
      '/nodes/0/asset',
      (d: ReturnType<typeof doc>) => {
        d.assets.photo.type = 'font';
      },
    ],
    [
      'bad-data-uri',
      '/assets/photo/source',
      (d: ReturnType<typeof doc>) => {
        d.assets.photo.source = 'data:image/png;base64,?';
      },
    ],
    [
      'bad-data-uri',
      '/assets/photo/source',
      (d: ReturnType<typeof doc>) => {
        d.assets.photo.source = 'data:image/png,%ZZ';
      },
    ],
    [
      'missing-source',
      '/assets/photo/source',
      (d: ReturnType<typeof doc>) => {
        d.assets.photo.source = '';
      },
    ],
    [
      'missing-key',
      '/assets/photo',
      (d: ReturnType<typeof doc>) => {
        delete d.assets.photo.source;
      },
    ],
    [
      'asset-storage',
      '/assets/photo/storage',
      (d: ReturnType<typeof doc>) => {
        d.assets.photo.storage = 'referenced';
      },
    ],
    [
      'undeclared-feature',
      '/nodes/0/type',
      (d: ReturnType<typeof doc>) => {
        d.requires = ['assets'];
      },
    ],
  ])('%s at %s', (code, pointer, mutate) => {
    const d = doc();
    mutate(d);
    const r = load(d);
    expect(r.model).toBeUndefined();
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({ code, pointer, message: expect.any(String) }),
    );
  });
  it('snapshots renderer-neutral draw geometry', () => {
    const p = new Player(load(doc()).model!);
    expect(drawFrame(p).nodes[0]!.geometry).toEqual({
      kind: 'image',
      x: 2,
      y: 2,
      width: 20,
      height: 20,
      image: {
        asset: 'photo',
        source: doc().assets.photo.source,
        width: 8,
        height: 4,
        fit: 'contain',
        align: 'center',
        sampling: 'nearest',
        wrapX: 'clamp',
        wrapY: 'clamp',
      },
    });
  });
  it('accepts percent-encoded binary bytes without requiring UTF-8', () => {
    const d = doc();
    d.assets.photo.source = 'data:image/png,%89PNG%0D%0A';
    expect(load(d).model).toBeDefined();
  });
  it('defaults to bilinear SVG sampling', () => {
    const d = doc();
    delete d.nodes[0].sampling;
    expect(toSVG(new Player(load(d).model!))).toContain('image-rendering="auto"');
  });
  it.each(fits)('lays out %s with clipping and every alignment', (fit) => {
    const sizes: Record<string, number[]> = {
      contain: [20, 10],
      cover: [40, 20],
      fill: [20, 20],
      resize: [20, 20],
      none: [8, 4],
      'scale-down': [8, 4],
      'fit-width': [20, 10],
      'fit-height': [40, 20],
    };
    for (const align of aligns) {
      const d = doc();
      Object.assign(d.nodes[0], { fit, align });
      const svg = toSVG(new Player(load(d).model!));
      const [w, h] = sizes[fit]!;
      expect(svg).toContain(
        `width="${w}" height="${h}" preserveAspectRatio="none" image-rendering="pixelated"`,
      );
      const factor = (lo: string, hi: string) =>
        align.includes(lo) ? 0 : align.includes(hi) ? 1 : 0.5;
      expect(svg).toContain(
        `x="${(20 - w!) * factor('left', 'right')}" y="${(20 - h!) * factor('top', 'bottom')}" width="${w}" height="${h}"`,
      );
      expect(svg).toContain('overflow="hidden"');
    }
  });
});
