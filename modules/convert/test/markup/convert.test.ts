import '@anima-format/core/all';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
import { describe, expect, it } from 'vitest';
const body = '<circle id="dot" cx="10" cy="10" r="1" fill="#000"/>';
const xml = (content: string) =>
  `<anima version="0.1" name="converter" grid="20" requires="convert">${content}${body}</anima>`;
describe('converter AniML', () => {
  it('compiles declarations, groups and canonical round trips', () => {
    const result = compile(
      xml(
        '<converter name="pct" type="range" from="0 1" to="0 100" clamp="true"/><converter name="label" type="template" text="{0} pts"/><converter-group name="fmt" chain="pct label"/>',
      ),
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.doc?.converters).toEqual({
      pct: { type: 'range', from: [0, 1], to: [0, 100], clamp: true },
      label: { type: 'template', text: '{0} pts' },
      fmt: { chain: ['pct', 'label'] },
    });
    expect(compile(decompile(result.doc!)).doc).toEqual(result.doc);
  });
  it.each([
    ['<converter name="x" type="nope"/>', 'convert-unknown-type'],
    ['<converter name="x" type="range" from="1 1"/>', 'convert-options'],
    ['<converter-group name="x" chain="x"/>', 'convert-cycle'],
    ['<converter name="x" type="range"/><converter name="x" type="round"/>', 'duplicate-name'],
    ['<converter name="x" type="range" surprise="true"/>', 'unknown-attribute'],
  ])('diagnoses %s', (source, code) => {
    const result = compile(xml(source));
    expect(result.doc).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        pointer: expect.any(String),
        line: 1,
        message: expect.any(String),
      }),
    );
  });
});
