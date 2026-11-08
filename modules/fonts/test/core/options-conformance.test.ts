import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { documentFonts } from '../../../../packages/cli/src/font/document.ts';
import { registerTextMeasurer, textLayout } from '../../../text/core/index.ts';
for (const name of ['text-variable-axes', 'text-opentype-features'])
  it('independent authored option layout: ' + name, () => {
    const file = 'spec/conformance/' + name + '/case.ani',
      doc = JSON.parse(readFileSync(file, 'utf8'));
    const fonts = documentFonts(doc, file);
    expect(fonts.diagnostics).toEqual([]);
    registerTextMeasurer(fonts.measurer);
    const result = load(doc);
    expect(result.diagnostics).toEqual([]);
    const player = new Player(result.model!);
    player.step(0);
    expect(textLayout(player, 0).width).toBeCloseTo(name.endsWith('axes') ? 2.2 : 2.4, 10);
    if (name.endsWith('axes')) {
      player.set('weight', 650);
      player.step(0);
      expect(textLayout(player, 0).lines[0]!.clusters[0]!.font.axes).toEqual({ wght: 650 });
    }
  });
it('keeps actual-font option diagnostics at authored style pointers', () => {
  const file = 'spec/conformance/text-variable-axes/case.ani',
    doc = JSON.parse(readFileSync(file, 'utf8'));
  doc.nodes[0].styles.s.axes = { nope: 1 };
  doc.nodes[0].styles.s.features = { nope: 1 };
  expect(documentFonts(doc, file).diagnostics).toEqual([
    expect.objectContaining({
      code: 'font-axis',
      pointer: '/nodes/0/styles/s/axes/nope',
      message: expect.any(String),
      hint: expect.any(String),
    }),
    expect.objectContaining({
      code: 'font-feature',
      pointer: '/nodes/0/styles/s/features/nope',
      message: expect.any(String),
      hint: expect.any(String),
    }),
  ]);
});

it('does not interpret arbitrary metadata or data objects as authored font styles', () => {
  const file = 'spec/conformance/text-variable-axes/case.ani',
    doc = JSON.parse(readFileSync(file, 'utf8'));
  doc.meta = { axes: { nope: 1 }, features: { nope: 1 } };
  doc.nodes[0].styles.s.font = 'sans-serif';
  doc.assets['sans-serif'] = doc.assets.body;
  expect(documentFonts(doc, file).diagnostics).toEqual([]);
});
