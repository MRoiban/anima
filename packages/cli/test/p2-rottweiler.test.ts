// Rottweiler P2 round-1 regressions: glyph bounds and render --compare.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../src/index.ts';
import { inspectGlyph } from '../src/glyphs.ts';
import { compareSVG } from '../src/render.ts';

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
