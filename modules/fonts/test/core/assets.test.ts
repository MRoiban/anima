import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load } from '../../../../packages/core/src/index.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
it('round trips font assets in both syntax spellings without browser decoding', () => {
  const source =
    '<anima version="0.1" name="font" grid="20" requires="assets fonts"><asset name="body" type="font" src="body.woff2"/><circle id="dot" cx="10" cy="10" r="1" fill="#000"/></anima>';
  const result = compile(source);
  expect(result.diagnostics).toEqual([]);
  expect(load(result.text!).diagnostics).toEqual([]);
  expect(decompile(result.text!)).toContain('type="font"');
});
it.each([
  ['missing-source', '/assets/body/source', { type: 'font', source: '' }],
  ['bad-data-uri', '/assets/body/source', { type: 'font', source: 'data:font/ttf;base64,!' }],
  [
    'asset-storage',
    '/assets/body/storage',
    { type: 'font', source: 'font.ttf', storage: 'embedded' },
  ],
])('preserves structured %s diagnostics for font assets', (code, pointer, asset) => {
  const result = load({
    anima: '0.1',
    name: 'bad-font',
    grid: 20,
    requires: ['assets', 'fonts'],
    assets: { body: asset },
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
  });
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code,
      pointer,
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});
