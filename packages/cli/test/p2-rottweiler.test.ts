// Rottweiler P2 round-1 regressions: glyph bounds and render --compare.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../src/index.ts';
import { inspectGlyph } from '../src/glyphs.ts';
import { compareSVG, comparisonSVG } from '../src/render.ts';

const dir = mkdtempSync(join(tmpdir(), 'anima-p2-rt-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function cli(...argv: string[]) {
  const out: string[] = [];
  const code = await run(argv, { out: (s) => out.push(s), err: (s) => out.push(s) });
  return { code, out: out.join('\n') };
}

const square = join(dir, 'square.animl');
writeFileSync(
  square,
  `<anima version="0.1" name="square" grid="20">
  <color name="ink" value="currentColor"/>
  <rect id="r" x0="5" y0="5" width="10" height="10" fill="ink"/>
</anima>`,
);
const body = '<rect x="5" y="5" width="10" height="10" fill="currentColor"/></svg>';
const reference = (attrs: string) => {
  const f = join(dir, `ref-${Math.random().toString(36).slice(2)}.svg`);
  writeFileSync(f, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"${attrs}>${body}`);
  return f;
};

describe('glyph subpath bounds (R1-6)', () => {
  it('keeps a cubic extremum when the quadratic term nearly vanishes', () => {
    // x(0.25) = 3750; the textbook root formula cancelled to a bogus t and lost it.
    expect(inspectGlyph('M0 0C10000 0 0 0 -29999.999999999993 0')[0]!.bbox).toEqual([
      -30000, 0, 3750, 0,
    ]);
  });
});

describe('render --compare', () => {
  it('normalizes root style values that hold quotes or newlines (R1-5)', () => {
    const plain = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">${body}`;
    for (const style of [` style='font-family:"Arial"'`, ` style="fill:red;\nopacity:1"`])
      expect(
        compareSVG(
          plain,
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"${style}>${body}`,
          20,
        ).pass,
      ).toBe(true);
  });

  it('normalizes roots with ">" in an attribute value or self-closing roots (R2-3)', () => {
    const plain = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">${body}`;
    const quoted = `<svg xmlns="http://www.w3.org/2000/svg" data-note="a > b" viewBox="0 0 20 20">${body}`;
    expect(compareSVG(plain, quoted, 20).pass).toBe(true);
    const empty = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"/>';
    expect(
      compareSVG(empty, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"></svg>`, 20)
        .pass,
    ).toBe(true);
  });

  it('normalizes the real root after a prolog, prefixed roots and whole attributes only (R3-1..3)', () => {
    const plain = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">${body}`;
    for (const reference of [
      `<?xml version="1.0"?><!-- example <svg/> --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" color="red">${body}`,
      `<!DOCTYPE svg [<!ENTITY example "<svg/>">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">${body}`,
      `<s:svg xmlns:s="http://www.w3.org/2000/svg" width="40" height="20" viewBox="0 0 20 20"><s:rect x="5" y="5" width="10" height="10" fill="currentColor"/></s:svg>`,
      `<svg xmlns="http://www.w3.org/2000/svg" data-note=' style="opacity:0"' viewBox="0 0 20 20">${body}`,
    ])
      expect(compareSVG(plain, reference, 20).pass, reference).toBe(true);
  });

  it('keeps the intrinsic user space of a root without viewBox (R4-1)', () => {
    const plain = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">${body}`;
    for (const size of ['20', '20px'])
      expect(
        compareSVG(
          plain,
          `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${body}`,
          64,
        ).pass,
      ).toBe(true);
  });

  it('reads SVG number syntax and exact-case viewBox/width/height (R5-1, R5-2)', () => {
    const plain = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">${body}`;
    const bare = (attrs: string) => `<svg xmlns="http://www.w3.org/2000/svg"${attrs}>${body}`;
    for (const size of ['2e1', '+20', '20.', '20E0px'])
      expect(compareSVG(plain, bare(` width="${size}" height="${size}"`), 64).pass, size).toBe(
        true,
      );
    // SVG ignores a lowercase viewbox; the intrinsic size still defines user space.
    expect(compareSVG(plain, bare(' width="20" height="20" viewbox="0 0 40 40"'), 64).pass).toBe(
      true,
    );
  });

  it('normalizes a root with long trailing whitespace in linear time (R4-2)', () => {
    const start = performance.now();
    comparisonSVG('<svg xmlns="http://www.w3.org/2000/svg"' + ' '.repeat(100_000) + '/>', 256);
    expect(performance.now() - start).toBeLessThan(1000); // was ~15 s
  });

  it('normalizes the reference ink and viewport with --browser-text too (R1-3)', async () => {
    for (const attrs of [' color="red"', ' width="40" height="20"']) {
      const f = reference(attrs);
      const plain = await cli('render', square, '--compare', f, '--size', '20');
      expect(plain.code, plain.out).toBe(0);
      const browser = await cli('render', square, '--compare', f, '--size', '20', '--browser-text');
      expect(browser.code, browser.out).toBe(0);
    }
  }, 60_000);

  it('rejects modes a comparison would silently skip (R1-4)', async () => {
    const f = reference('');
    for (const extra of [
      ['--frames', '2', '--fps', 'NaN'],
      ['--probe', '1,1'],
      ['--audio', join(dir, 'x.wav')],
      ['--viewport', '40x20'],
      ['--scale', '0.5'],
      ['--fit', 'cover'],
    ])
      expect((await cli('render', square, '--compare', f, '--size', '20', ...extra)).code).toBe(2);
    const plain = await cli('render', square, '--compare', f, '--size', '20');
    expect(plain.code, plain.out).toBe(0);
  });
});

describe('inspect glyphs (R2-2)', () => {
  it('skips a $comment in the glyph map', async () => {
    const f = join(dir, 'comment.ani');
    const doc = JSON.parse(
      readFileSync(new URL('../../../examples/moon.ani', import.meta.url), 'utf8'),
    );
    doc.glyphs.$comment = 'notes';
    writeFileSync(f, JSON.stringify(doc));
    const r = await cli('inspect', f, '--format=json');
    expect(r.code, r.out).toBe(0);
    expect(Object.keys(JSON.parse(r.out).glyphs)).toEqual(['moon']);
    expect((await cli('inspect', f)).code).toBe(0);
  });
});
