import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';
import { compile } from '@anima-format/markup';
import { layoutText } from '../../../text/core/layout.ts';
import { registerTextMeasurer } from '../../../text/core/measure.ts';
import { textHit, textSelection } from '../../../text/core/hit.ts';
import { createTextRunAccess, text } from '../../../text/core/index.ts';
import { ToolMeasurer } from '../../../../packages/cli/src/font/measure.ts';
import { Font } from '../../../../packages/cli/src/font/reader.ts';
import { testFont } from '../../../../tools/test-font.ts';
const tool = new ToolMeasurer();
tool.register('Test', new Font(testFont()));
tool.register('sans-serif', new Font(testFont()));
registerTextMeasurer(tool);
const styles = { s: { font: 'Test', size: 10 } };
const layout = (source: string, extra = {}) =>
  layoutText({ styles, runs: [{ style: 's', text: source }], ...extra });

it('hit positions and selections use grapheme ordinals across runs, emoji and combining marks', () => {
  const source = 'Ae\u0301😀B',
    l = layout(source);
  expect(l.lines[0]!.clusters).toHaveLength(4);
  for (let i = 0; i < 4; i++) {
    const c = l.lines[0]!.clusters[i]!;
    expect(textHit(l, source, c.x + c.advance * 0.1, c.y)).toBe(i);
    expect(textHit(l, source, c.x + c.advance * 0.9, c.y)).toBe(i + 1);
  }
  expect(textSelection(l, source, 2, 3)).toEqual([[18, 0.5, 6, 10]]);
  expect(textSelection(l, source, 3, 2)).toEqual(textSelection(l, source, 2, 3));
  expect(textSelection(l, source, -100, 99)).toEqual([[0, 0.5, 30, 10]]);
  expect(textSelection(l, source, 2)).toEqual([[18, 0.5, 0, 10]]);
});
it('wrapping, explicit/empty lines, origins, fitting and empty output preserve layout coordinates', () => {
  const source = 'ABCD',
    wrapped = layout(source, { sizing: 'auto-height', width: 12, wordBreak: 'break-all' });
  expect(textSelection(wrapped, source, 0, 4)).toEqual([
    [0, 0.5, 12, 10],
    [0, 11.5, 12, 10],
  ]);
  expect(textSelection(wrapped, source, 2)).toEqual([[0, 11.5, 0, 10]]);
  expect(textHit(wrapped, source, 100, 12)).toBe(4);
  expect(textHit(wrapped, source, -100, -100)).toBe(0);
  const breaks = layout('A\n\nB');
  expect(textSelection(breaks, 'A\n\nB', 2)).toEqual([[0, 11.5, 0, 10]]);
  expect(textSelection(breaks, 'A\n\nB', 3)).toEqual([[0, 22.5, 0, 10]]);
  const fit = layout('AB', {
    width: 6,
    height: 5.5,
    sizing: 'fixed',
    wrap: false,
    overflow: 'fit',
    origin: 'baseline',
  });
  expect(textSelection(fit, 'AB', 0, 2)).toEqual([[0, -4, 6, 5]]);
  expect(textSelection(layout(''), '', 0)[0]![2]).toBe(0);
  expect(textHit(layout('AB', { width: 0, height: 0, overflow: 'fit' }), 'AB', 1, 1)).toBe(0);
});
function player(source: string) {
  const built = compile(source);
  expect(built.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const result = load(built.doc!);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(result.model!);
}
it('inferred labels include visible descendant runs in order, explicit labels win, and binding/host edits invalidate', () => {
  const p = player(`<anima version="0.1" name="inferred" grid="100" requires="a11y text data">
    <model name="M"><string name="name" default="AB"/></model><instance name="main" model="M" default="true"/>
    <group id="group"><a11y role="button"/>
      <text id="title" x="10" y="20"><a11y role="text"/><style id="s" font="Test" size="10"/><run id="value" style="s" text="$name"/><run style="s" text="C"/></text>
      <group id="hidden"><a11y role="group" hidden="true"/><text id="skip"><run text="Hidden"/></text></group>
      <text id="explicit"><a11y role="text" label=""/><run text="D"/></text>
    </group></anima>`);
  const tree = p.semantics();
  expect(tree[0]!.label).toBe('ABCD');
  expect(tree[0]!.children.map((n) => n.label)).toEqual(['ABC', '']);
  expect(tree[0]!.children[0]!.bounds).toEqual([10, 20.5, 18, 10]);
  expect(p.semantics()).toBe(tree);
  p.set('$name', 'A');
  p.step(0);
  expect(p.semantics()[0]!.label).toBe('ACD');
  expect(p.semanticDiff(tree, p.semantics()).changed.find((n) => n.id === 'title')!.keys).toContain(
    'bounds',
  );
  expect(p.semantics()[0]!.children[0]!.bounds[2]).toBe(12);
  createTextRunAccess(text)(p, 'title', 'value', 'XY');
  expect(p.semantics()[0]!.label).toBe('XYCD');
  expect(p.semanticDiff(tree, p.semantics()).changed.find((n) => n.id === 'title')!.keys).toContain(
    'label',
  );
});
it('text bounds transform all layout corners, honor explicit bounds and refresh when measurers change', () => {
  const p = player(`<anima version="0.1" name="bounds" grid="100" requires="a11y text">
    <group id="g" x="10" y="20" rotate="90"><text id="label"><a11y role="text"/><style id="s" font="Test" size="10"/><run style="s" text="AB"/></text></group>
    <text id="explicit"><a11y role="text" bounds="1 2 3 4"/><run text="A"/></text></anima>`);
  const bounds = p.semantics()[0]!.bounds;
  expect(bounds[0]).toBeCloseTo(-0.5);
  expect(bounds[1]).toBeCloseTo(20);
  expect(bounds[2]).toBeCloseTo(10);
  expect(bounds[3]).toBeCloseTo(12);
  expect(p.semantics()[1]!.bounds).toEqual([1, 2, 3, 4]);
  const old = p.semantics();
  registerTextMeasurer({
    measure(font, s) {
      const m = tool.measure(font, s);
      return { ...m, ascent: m.ascent * 2 };
    },
  });
  expect(p.semantics()).not.toBe(old);
  registerTextMeasurer(tool);
});
it('listeners write the text-local hit index and validate target and input types', () => {
  const source = `<anima version="0.1" name="listener" grid="100" requires="text input">
 <number name="index" default="-1"/><text id="label" x="10" y="20" ><style id="s" font="Test" size="10"/><run style="s" text="Aé😀B"/></text>
 <listener on="down" target="label" write='{"text-index":"index"}'/></anima>`;
  const p = player(source);
  p.pointer('down', 29, 25);
  p.step(0);
  expect(p.get('index')).toBe(2);
  const bad = compile(source.replace('target="label"', ''));
  const result = bad;
  expect(
    result.diagnostics.some(
      (d) =>
        d.code === 'input-write' &&
        d.pointer === '/listeners/0/write/text-index' &&
        d.message &&
        d.hint,
    ),
  ).toBe(true);
  const typed = compile(
    source.replace('<number name="index" default="-1"/>', '<bool name="index"/>'),
  );
  expect(
    typed.diagnostics.some(
      (d) => d.code === 'input-write' && d.pointer === '/listeners/0/write/text-index',
    ),
  ).toBe(true);
});

it('text inference and layout bounds traverse nested instances and repeated rows', () => {
  const p =
    player(`<anima version="0.1" name="nested-text" grid="100" requires="text a11y components data lists">
    <model name="M"><number name="n" default="2"/></model><instance name="main" model="M" default="true"/>
    <component name="row" grid="100"><text id="label"><style id="s" font="Test" size="10"/><run style="s" text="AB"/></text></component>
    <instance id="a" component="row" x="10"><a11y role="group"/></instance>
    <repeat id="rows" component="row" count="$n" dx="20"><a11y role="group"/></repeat>
  </anima>`);
  p.step(0);
  expect(p.semantics().map((n) => [n.id, n.label, n.bounds])).toEqual([
    ['a', 'AB', [10, 0.5, 12, 10]],
    ['rows', 'ABAB', [0, 0.5, 32, 10]],
  ]);
});
it('retains the native inferred-label/metric observations without claiming equivalence', () => {
  const read = (name: string) =>
    JSON.parse(
      readFileSync(
        new URL('../../oracle/text/rive/frames/' + name + '.json', import.meta.url),
        'utf8',
      ),
    );
  const native = read('tree').roots;
  expect(native.map((n: { label: string }) => n.label)).toEqual(['', 'Override']);
  expect(native[0].children[0].label).toBe('');
  expect(native[0].bounds).toEqual({ x: 10, y: 20, width: 18.0029297, height: 10 });
  expect(read('no-child-semantic').roots[0].children).toEqual([]);
  const p = player(
    `<anima version="0.1" name="native-observation" grid="100" requires="text a11y"><text id="label" x="10" y="20"><a11y role="text"/><style id="s" font="Test" size="10"/><run style="s" text="ABC"/></text></anima>`,
  );
  expect(p.semantics()[0]!.label).toBe('ABC');
  expect(p.semantics()[0]!.bounds).toEqual([10, 20.5, 18, 10]);
});

it('overlapping advances keep selection rectangles nonnegative and semantic/pointer bounds enclose all clusters', () => {
  const source = 'ABC',
    l = layoutText({
      styles: { s: { font: 'Test', size: 10, tracking: -10 } },
      runs: [{ style: 's', text: source }],
    });
  expect(textSelection(l, source, 0, 3)).toEqual([[-8, 0.5, 8, 10]]);
  const p = player(
    `<anima version="0.1" name="negative-tracking" grid="100" requires="text a11y input"><number name="index" default="-1"/><text id="label"><a11y role="text"/><style id="s" font="Test" size="10" tracking="-10"/><run style="s" text="ABC"/></text><listener on="down" target="label" write='{ "text-index":"index" }'/></anima>`,
  );
  expect(p.semantics()[0]!.bounds).toEqual([-8, 0.5, 14, 10]);
  p.pointer('down', -6, 5);
  p.step(0);
  expect(p.get('index')).toBe(1);
});

it('inferred labels refresh while a font consumer returns one stable pending layout', () => {
  const original = text.textLayout;
  const empty = {
    lines: [],
    width: 0,
    height: 0,
    contentWidth: 0,
    contentHeight: 0,
    fittedSize: 0,
    scale: 1,
  };
  text.textLayout = () => empty;
  try {
    const p = player(
      `<anima version="0.1" name="pending-font-label" grid="100" requires="text a11y data"><model name="M"><string name="name" default="Before"/></model><instance name="main" model="M" default="true"/><text id="label"><a11y role="text"/><run text="$name"/></text></anima>`,
    );
    const old = p.semantics();
    expect(old[0]!.label).toBe('Before');
    p.set('$name', 'After');
    p.step(0);
    expect(p.semantics()[0]!.label).toBe('After');
    expect(p.semantics()).not.toBe(old);
  } finally {
    text.textLayout = original;
  }
});
