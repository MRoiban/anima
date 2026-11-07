import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load } from '@anima-format/core';
const doc = (node: Record<string, unknown>, extra = {}) => ({
  anima: '0.1',
  name: 'invalid-text',
  grid: 20,
  requires: ['text'],
  nodes: [{ id: 't', type: 'text', runs: [], ...node }],
  ...extra,
});
for (const [field, value] of Object.entries({
  width: -1,
  height: -1,
  sizing: 'bad',
  align: 'bad',
  valign: 'bad',
  overflow: 'bad',
  wrap: 1,
  wordBreak: 'bad',
  origin: 'bad',
  lineHeight: -1,
  paragraphSpacing: -1,
  verticalTrimTop: 'bad',
  verticalTrimBottom: 'bad',
  fitFromBaseline: 1,
  fitFontSizeResizesBox: 1,
  textField: 1,
  styleField: 1,
  styles: [],
  runs: 1,
}))
  it('validates ' + field, () => {
    const r = load(doc({ [field]: value }));
    const d = r.diagnostics.find((d) => d.pointer === '/nodes/0/' + field);
    expect(d).toBeDefined();
    expect(d!.code).toBeTruthy();
    expect(d!.message.length).toBeGreaterThan(0);
    expect(d!.severity).toBe('error');
  });
for (const [field, value] of Object.entries({
  font: 1,
  size: 0,
  weight: 1001,
  style: 'bad',
  tracking: 'px',
  lineHeight: -1,
  fill: { color: 'no' },
  stroke: { width: -1, color: '#000' },
}))
  it('validates style ' + field, () => {
    const r = load(doc({ styles: { s: { [field]: value } } }));
    expect(r.diagnostics.some((d) => d.pointer.startsWith('/nodes/0/styles/s/' + field))).toBe(
      true,
    );
  });
for (const [node, code, pointer] of [
  [{ sizing: 'fixed' }, 'text-box', '/nodes/0/sizing'],
  [{ sizing: 'auto-height' }, 'text-box', '/nodes/0/sizing'],
  [{ overflow: 'ellipsis' }, 'text-box', '/nodes/0/overflow'],
  [{ runs: [{ text: 'x', style: 'unknown' }] }, 'text-style', '/nodes/0/runs/0/style'],
  [{ runs: '$items' }, 'text-source', '/nodes/0/runs'],
  [{ runs: [{ text: '$title' }] }, 'text-source', '/nodes/0/runs/0/text'],
] as const)
  it('reports ' + code + ' at ' + pointer, () => {
    const r = load(doc(node));
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        pointer,
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
  });
it('requires declaration of text and accepts no unknown run fields', () => {
  expect(
    load(doc({}, { requires: [] })).diagnostics.some((d) => d.code === 'undeclared-feature'),
  ).toBe(true);
  expect(load(doc({ runs: [{ text: 'x', bad: 1 }] })).diagnostics).toContainEqual(
    expect.objectContaining({ code: 'unknown-key', pointer: '/nodes/0/runs/0/bad' }),
  );
});
it('uses the authored shared style location and escapes pointer tokens', () => {
  const r = load(
    doc(
      { runs: [{ text: 'a', style: 'odd/name' }] },
      { textStyles: { 'odd/name': { fill: { color: 'bad' } } } },
    ),
  );
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({ code: 'text-paint', pointer: '/textStyles/odd~1name/fill' }),
  );
});
it('rejects interpolation eases on text run strings', () => {
  const r = load(
    doc(
      { runs: [{ text: 'ab' }] },
      {
        timelines: {
          t: {
            duration: 1,
            tracks: {
              't.runs.0.text': [
                [0, 'ab', 'linear'],
                [1, 'cd'],
              ],
            },
          },
        },
      },
    ),
  );
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({ code: 'bad-ease', pointer: '/timelines/t/tracks/t.runs.0.text/0/2' }),
  );
});

it('infers fixed sizing only when both dimensions are present', () => {
  for (const overflow of ['visible', 'hidden', 'clipped', 'ellipsis', 'fit', 'fit-font-size'])
    expect(load(doc({ width: 4, height: 4, overflow })).diagnostics).toEqual([]);
  expect(load(doc({ width: 4, overflow: 'ellipsis' })).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'text-box',
      pointer: '/nodes/0/overflow',
      hint: expect.stringContaining('width and height'),
    }),
  );
  expect(
    load(doc({ width: 4, height: 4, sizing: 'auto-width', overflow: 'ellipsis' })).diagnostics,
  ).toContainEqual(expect.objectContaining({ code: 'text-box', pointer: '/nodes/0/overflow' }));
});
