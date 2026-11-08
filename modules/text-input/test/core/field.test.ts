import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player, runScript, drawFrame, toSVG } from '@anima-format/core';
import { compile, decompile } from '@anima-format/markup';
import { field, edit, select } from '../../core/index.ts';
import { registerTextMeasurer } from '../../../text/core/measure.ts';
import { textLayout } from '../../../text/core/index.ts';
registerTextMeasurer({
  measure: (_font, value) => ({
    advances: Float64Array.from(
      [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(value)],
      (_, i) => i + 1,
    ),
    ascent: 0.8,
    descent: 0.2,
    capHeight: 0.7,
    xHeight: 0.5,
    lineGap: 0,
  }),
});
export const document = (config: Record<string, unknown> = {}) => ({
  anima: '0.1',
  name: 'field',
  grid: 20,
  requires: ['text', 'textinput', 'a11y', 'focus', 'data'],
  data: {
    models: { Search: { properties: { query: { type: 'string', default: '' } } } },
    instances: { main: { model: 'Search', default: true } },
  },
  nodes: [
    {
      id: 'q',
      type: 'text',
      x: 2,
      y: 3,
      sizing: 'fixed',
      width: 10,
      height: 4,
      runs: [{ text: '' }],
      textInput: { label: 'Search', placeholder: 'Find', writeText: '$query', ...config },
    },
  ],
  listeners: [{ target: 'q', on: 'text', emit: 'committed' }],
});
function player(c: Record<string, unknown> = {}) {
  const result = load(document(c));
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(result.model!);
}
it('headless typing replaces selections, composition commits once, and text listeners follow data writes', () => {
  const p = player();
  p.step(0);
  p.focusTarget('q');
  edit(p, 'q', 'a');
  expect(p.get('$query')).toBe('');
  expect(p.step(0).events.map((e) => e.name)).toEqual(['committed']);
  edit(p, 'q', 'ab', 2, 2, true);
  expect(p.step(0).events).toEqual([]);
  expect(p.get('$query')).toBe('a');
  edit(p, 'q', 'ab');
  expect(p.step(0).events.map((e) => e.name)).toEqual(['committed']);
  expect(p.get('$query')).toBe('ab');
  const r = runScript(p.model, 'focus target q\ntype "abc"\nselect 1 2\ncompose "é"\nsemantics');
  expect(field(r.player, 'q')).toMatchObject({
    value: 'aéc',
    start: 2,
    end: 2,
    composing: false,
  });
  expect((r.output[0] as { value: string }[])[0]).toMatchObject({
    role: 'text-field',
    value: 'aéc',
    bounds: [2, 3, 10, 4],
  });
});
it('limits are shared by programmatic/native edits, normalize newlines and preserve surrogate pairs', () => {
  const p = player({ multiline: true, maxLength: 6, maxLines: 2 });
  edit(p, 'q', 'a\r\nb\nc');
  expect(field(p, 'q')!.value).toBe('a\nb');
  edit(p, 'q', 'abcd😀z');
  expect(field(p, 'q')!.value).toBe('abcd😀');
  const q = player({ maxLength: 5 });
  edit(q, 'q', 'abcd😀');
  expect(field(q, 'q')!.value).toBe('abcd');
  edit(q, 'q', 'a\nb');
  expect(field(q, 'q')!.value).toBe('ab');
});
it('readonly fields reject edits and select-on-focus works in headless runs', () => {
  const doc = document({ editable: false, selectOnFocus: true });
  doc.data.models.Search.properties.query.default = 'abc';
  const p = new Player(load(doc).model!);
  p.step(0);
  p.focusTarget('q');
  expect(field(p, 'q')).toMatchObject({ value: 'abc', start: 0, end: 3 });
  edit(p, 'q', 'changed');
  expect(field(p, 'q')!.value).toBe('abc');
});
it('external queued writes refresh the field and its semantic value', () => {
  const p = player();
  p.step(0);
  p.set('$query', 'host');
  p.step(0);
  expect(field(p, 'q')!.value).toBe('host');
  expect(p.semantics()[0]!.value).toBe('host');
});
it('draws a placeholder, rounded selection and a steady caret using layout geometry', () => {
  const p = player({ selectionColor: '#aabbcc', selectionRadius: 0.2, caretColor: '#ff0000' });
  p.step(0);
  expect(
    textLayout(p, 0)
      .lines[0]!.clusters.map((c) => c.text)
      .join(''),
  ).toBe('Find');
  p.focusTarget('q');
  edit(p, 'q', 'abcd');
  p.step(0);
  select(p, 'q', 1, 3);
  const frame = drawFrame(p);
  expect((frame.nodes[0] as import('../../core/index.ts').FieldNode).fieldBoxes).toEqual([
    { x: 1, y: 0, width: 2, height: 1, color: '#aabbcc', radius: 0.2 },
  ]);
  expect(toSVG(p)).toContain('rx="0.2"');
  select(p, 'q', 4);
  expect(toSVG(p)).toContain('fill="#ff0000"');
});
it('obscured drawing retains UTF-16 offsets and semantics omit secrets', () => {
  const p = player({ obscured: true });
  p.step(0);
  edit(p, 'q', 'a😀');
  p.step(0);
  expect(
    textLayout(p, 0)
      .lines[0]!.clusters.map((c) => c.text)
      .join(''),
  ).toBe('•••');
  expect(p.semantics()[0]).toMatchObject({
    role: 'text-field',
    states: { obscured: true, multiline: false },
  });
  expect(p.semantics()[0]!.value).toBeUndefined();
});
it.each([
  [
    'missing peers',
    (d: ReturnType<typeof document>) => {
      d.requires = d.requires.filter((s) => s !== 'focus');
    },
    '/nodes/0/textInput',
  ],
  [
    'multiple runs',
    (d: ReturnType<typeof document>) => {
      d.nodes[0]!.runs.push({ text: 'extra' });
    },
    '/nodes/0/runs',
  ],
  [
    'bound run',
    (d: ReturnType<typeof document>) => {
      d.nodes[0]!.runs[0]!.text = '$query';
    },
    '/nodes/0/runs',
  ],
  [
    'auto sizing',
    (d: ReturnType<typeof document>) => {
      d.nodes[0]!.sizing = 'auto-width';
    },
    '/nodes/0/textInput',
  ],
  [
    'empty box',
    (d: ReturnType<typeof document>) => {
      d.nodes[0]!.width = 0;
    },
    '/nodes/0/textInput',
  ],
  [
    'line limit',
    (d: ReturnType<typeof document>) => {
      Object.assign(d.nodes[0]!.textInput, { maxLines: 2 });
    },
    '/nodes/0/textInput/maxLines',
  ],
  [
    'write target',
    (d: ReturnType<typeof document>) => {
      d.nodes[0]!.textInput.writeText = 'missing';
    },
    '/nodes/0/textInput/writeText',
  ],
  [
    'multiline password',
    (d: ReturnType<typeof document>) => {
      Object.assign(d.nodes[0]!.textInput, { multiline: true, obscured: true });
    },
    '/nodes/0/textInput/obscured',
  ],
  [
    'duplicate semantics',
    (d: ReturnType<typeof document>) => {
      Object.assign(d.nodes[0]!, { a11y: { role: 'text', label: 'duplicate' } });
    },
    '/nodes/0/a11y',
  ],
])('diagnoses %s with a repair hint', (_label, change, pointer) => {
  const d = document();
  change(d);
  const errors = load(d).diagnostics;
  expect(errors).toContainEqual(
    expect.objectContaining({
      code: 'text-input-config',
      pointer,
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});
it.each([
  { maxLength: -1 },
  { maxLength: 1.5 },
  { maxLines: 0 },
  { selectionRadius: -1 },
  { editable: 'yes' },
  { caretColor: 'url(https://example.invalid/a)' },
  { selectionColor: 'red;stroke:url(x)' },
])('registry rejects invalid field types/ranges %j', (c) => {
  expect(
    load(document(c)).diagnostics.some(
      (d) => d.severity === 'error' && d.pointer.startsWith('/nodes/0/textInput/'),
    ),
  ).toBe(true);
});
it('AniML child fields and JSON spellings round trip without compiler changes', () => {
  const d = document({ selectOnFocus: true, maxLength: 30, selectionRadius: 0.2 });
  const xml = decompile(d);
  expect(xml).toContain('<text-input');
  expect(xml).toContain('write-text="$query"');
  expect(xml).toContain('max-length="30"');
  const result = compile(xml);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect((result.doc!.nodes as { textInput: unknown }[])[0]!.textInput).toMatchObject(
    d.nodes[0]!.textInput,
  );
});
it.each(['type "abc"', 'compose "abc"', 'select 0 2'])(
  'script rejects an unfocused field: %s',
  (script) => {
    expect(() => runScript(player().model, script)).toThrow('focused text field');
  },
);
it('fields preserve semantic parent ordering and modal exclusion', () => {
  const d = document();
  const q = d.nodes[0]!;
  (d as { nodes: unknown[] }).nodes = [
    { id: 'group', type: 'group', a11y: { role: 'group', label: 'Form' }, children: [q] },
    {
      id: 'modal',
      type: 'group',
      a11y: { role: 'dialog', label: 'Dialog', modal: true, bounds: [0, 0, 4, 4] },
    },
  ];
  const r = load(d);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  p.step(0);
  expect(p.semantics().map((n) => n.id)).toEqual(['modal']);
  expect(p.focusItems().some((n) => n.id === 'q')).toBe(false);
});
it('cancelled composition does not create a committed-text event', () => {
  const p = player();
  p.step(0);
  edit(p, 'q', 'draft', 5, 5, true);
  p.step(0);
  edit(p, 'q', '');
  expect(p.step(0).events).toEqual([]);
  expect(p.get('$query')).toBe('');
});

it('inferred focus stays in the compiled node, without mutating authored documents', () => {
  const d = document();
  const before = JSON.stringify(d);
  const r = load(d);
  expect(r.model!.nodes[0]!.raw.focus).toBeDefined();
  expect(JSON.stringify(d)).toBe(before);
  expect(r.model!.doc.nodes[0].focus).toBeUndefined();
});
