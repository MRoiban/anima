import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { run } from '../../../../packages/cli/src/cli.ts';
import { Font } from '../../../../packages/cli/src/font/reader.ts';
import { ToolMeasurer } from '../../../../packages/cli/src/font/measure.ts';
import { outlineSVG } from '../../../../packages/cli/src/font/svg.ts';
import { testFont } from '../../../../tools/test-font.ts';
import { load, Player, toSVG } from '@anima-format/core';
import {
  documentCharacters,
  buildFont,
  installToolMeasurer,
} from '../../../../packages/cli/src/font/document.ts';

it('flattens an actual text document and renders its font override to SVG and PNG', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'anima-text-integration-'));
  const messages: string[] = [];
  const io = { out: (s: string) => messages.push(s), err: (s: string) => messages.push(s) };
  try {
    const source = join(dir, 'text.ani');
    const doc = {
      anima: '0.1',
      name: 'text-integration',
      grid: 20,
      requires: ['text'],
      nodes: [
        {
          id: 'label',
          type: 'text',
          x: 2,
          y: 3,
          width: 10,
          height: 5,
          sizing: 'fixed',
          overflow: 'ellipsis',
          wrap: false,
          styles: {
            s: {
              font: 'local',
              size: 2,
              fill: { color: '#123456' },
              stroke: { color: '#456789', width: 0.05 },
            },
          },
          runs: [{ text: 'AV  AV  AV  AV  AV', style: 's' }],
        },
      ],
    };
    writeFileSync(source, JSON.stringify(doc));
    const fontArgs = ['--font', 'local=' + resolve('fixtures/fonts/anima-test.ttf')];
    const flattened = join(dir, 'flattened.ani');
    expect(
      await run(['flatten', source, ...fontArgs, '-o', flattened], io),
      messages.join('\n'),
    ).toBe(0);
    const result = JSON.parse(readFileSync(flattened, 'utf8'));
    expect(result.nodes[0]).toMatchObject({ id: 'label', type: 'group', x: 2, y: 3 });
    expect(JSON.stringify(result.nodes)).not.toContain('"type":"text"');
    expect(JSON.stringify(result.nodes)).toContain('"type":"path"');
    expect(load(result).diagnostics).toEqual([]);
    for (const ext of ['svg', 'png']) {
      const output = join(dir, 'text.' + ext);
      expect(
        await run(['render', source, ...fontArgs, '-o', output], io),
        messages.join('\n'),
      ).toBe(0);
      const bytes = readFileSync(output);
      if (ext === 'png') expect(bytes.subarray(1, 4).toString()).toBe('PNG');
      else {
        expect(bytes.toString()).not.toContain('<text');
        expect(bytes.toString()).toContain('fill="#123456"');
      }
    }
    const measurer = new ToolMeasurer();
    measurer.register('local', new Font(testFont()));
    await installToolMeasurer(measurer);
    const original = new Player(load(doc).model!);
    const frozen = new Player(load(result).model!);
    // Geometry retains every glyph and paint, including preserved consecutive spaces.
    expect(toSVG(frozen).match(/<path/g)?.length).toBe(
      outlineSVG(toSVG(original), measurer).match(/<path/g)?.length,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 30000);

it('has deterministic ellipsis coverage and rejects unsupported text CSS explicitly', () => {
  const bytes = testFont();
  expect(bytes).toEqual(testFont());
  expect(bytes).toEqual(readFileSync('fixtures/fonts/anima-test.ttf'));
  const font = new Font(bytes);
  expect(font.hasGlyph('…')).toBe(true);
  expect(font.glyph(0x2026)).not.toBe(0);
  const measurer = new ToolMeasurer();
  measurer.register('Anima Test', font);
  const svg = outlineSVG(
    '<svg><text style="font-family:Anima Test;font-size:10;fill:#123456;white-space:pre;text-rendering:geometricPrecision">AV</text></svg>',
    measurer,
  );
  expect(svg).toContain('fill="#123456"');
  expect(svg).not.toContain('style=');
  expect(() =>
    outlineSVG('<svg><text style="filter:blur(2px)">A</text></svg>', measurer),
  ).toThrowError(
    expect.objectContaining({ code: 'font-unsupported', pointer: expect.any(String) }),
  );
});

it('retains the implicit ellipsis when subsetting used glyphs', () => {
  const doc = { nodes: [{ type: 'text', overflow: 'ellipsis', runs: [{ text: 'AV' }] }] };
  expect(documentCharacters(doc)).toContain('…');
  const asset = {
    type: 'font',
    source: 'data:font/ttf;base64,' + testFont().toString('base64'),
    glyphs: 'used' as const,
  };
  buildFont(asset, doc as object, 'scene.ani');
  const font = new Font(Buffer.from(asset.source.split(',')[1]!, 'base64'));
  expect(font.hasGlyph('…')).toBe(true);
  expect(font.hasGlyph('A')).toBe(true);
  expect(font.hasGlyph('B')).toBe(false);
});
