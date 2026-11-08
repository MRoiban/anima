import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { load, Player } from '@anima-format/core';
import { compile } from '@anima-format/markup';
import { textLayout, textRun, registerTextMeasurer } from '../../core/index.ts';
import { ToolMeasurer } from '../../../../packages/cli/src/font/measure.ts';
import { Font } from '../../../../packages/cli/src/font/reader.ts';
import { testFont } from '../../../../tools/test-font.ts';
const measurer = new ToolMeasurer();
measurer.register('sans-serif', new Font(testFont()));
for (const name of readdirSync('modules/text/capabilities').filter(
  (name) => name !== 'text-flatten',
))
  it('text layout conformance ' + name, () => {
    registerTextMeasurer(measurer);
    const base = 'spec/conformance/' + name + '/';
    const c = compile(readFileSync(base + 'case.animl', 'utf8'));
    expect(c.diagnostics).toEqual([]);
    const r = load(c.doc!);
    expect(r.diagnostics).toEqual([]);
    const p = new Player(r.model!);
    p.step(0);
    let target = p;
    if (name === 'host-api-text-run') {
      expect(textRun(p, 'label', 'first')).toBe('abcd');
      expect(textRun(p, 'label', 'first', 'WXYZ')).toBe('WXYZ');
      p.step(0);
      expect(textRun(p, 'label', 'first')).toBe('WXYZ');
    }
    if (name === 'host-api-nested-text-run') {
      expect(textRun(p, 'a/label', 'first')).toBe('abcd');
      expect(textRun(p, 'a/label', 'first', 'WXYZ')).toBe('WXYZ');
      p.step(0);
      expect(textRun(p, 'b/label', 'first')).toBe('abcd');
      target = (p.nested as unknown as { players: Map<string, Player> }).players.get('a')!;
    }
    const l = textLayout(target, 0);
    const observed = {
      width: l.width,
      height: l.height,
      widths: l.lines.map((l) => l.width),
      baselines: l.lines.map((l) => l.baseline),
      fittedSize: l.fittedSize,
      scale: l.scale,
      firstX: l.lines[0]?.clusters[0]?.x,
      contentHeight: l.contentHeight,
      strings: l.lines.map((l) => l.clusters.map((c) => c.text).join('')),
      clip: l.clip,
    };
    const expected = JSON.parse(readFileSync(base + 'layout.expected.json', 'utf8')) as Record<
      string,
      unknown
    >;
    for (const [key, want] of Object.entries(expected)) {
      const got = observed[key as keyof typeof observed];
      if (typeof want === 'number') expect(got, key).toBeCloseTo(want, 5);
      else if (Array.isArray(want) && typeof want[0] === 'number')
        want.forEach((v, i) => expect((got as number[])[i], key).toBeCloseTo(v, 5));
      else expect(got, key).toEqual(want);
    }
  });
