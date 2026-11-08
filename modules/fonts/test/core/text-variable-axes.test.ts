import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player, drawFrame, toSVG } from '../../../../packages/core/src/index.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
import { registerTextMeasurer, textLayout } from '../../../text/core/index.ts';
import { ToolMeasurer } from '../../../../packages/cli/src/font/measure.ts';
import { Font } from '../../../../packages/cli/src/font/reader.ts';
import { testFont } from '../../../../tools/test-font.ts';
import { outlineSVG } from '../../../../packages/cli/src/font/svg.ts';

export const axisSource = `<anima version="0.1" name="axes" grid="20" requires="text fonts bind">
  <text-style id="shared" axes='{"wght":900}' features='{"kern":0}'/>
  <number name="weight" default="400" min="100" max="900"/>
  <text id="label" line-height="1">
    <style id="s" font="body" size="2" axes='{"wght":400}'/>
    <run text="AV" style="s"/>
  </text>
  <bind target="label.styles.s.axes.wght" value="weight"/>
</anima>`;
export function measurer() {
  const tool = new ToolMeasurer();
  tool.register('body', new Font(testFont()));
  registerTextMeasurer(tool);
  return tool;
}
it('authors both style forms, round trips both spellings, and resolves bound axes before layout', () => {
  const tool = measurer();
  const built = compile(axisSource);
  expect(built.diagnostics).toEqual([]);
  expect(compile(decompile(built.text!)!).doc).toEqual(built.doc);
  const result = load(built.doc!);
  expect(result.diagnostics).toEqual([]);
  const p = new Player(result.model!);
  p.step(0);
  expect(textLayout(p, 0).width).toBeCloseTo(2.2, 10); // 600+600-100, size 2
  const normal = outlineSVG(toSVG(p), tool);
  p.set('weight', 650);
  p.step(0);
  expect(textLayout(p, 0).lines[0]!.clusters[0]!.font.axes).toEqual({ wght: 650 });
  expect(textLayout(p, 0).width).toBeCloseTo(2.2, 10); // fixture's phantom advances do not vary
  expect(toSVG(p)).toContain('font-variation-settings:&quot;wght&quot; 650');
  const varied = outlineSVG(toSVG(p), tool);
  expect(varied).not.toBe(normal); // original fixture right edge shifts 50 units at 650
  expect(drawFrame(p).nodes[0]).toBeDefined();
});
it('interpolates authored axis timeline slots and preserves immutable rest maps', () => {
  measurer();
  const doc = compile(axisSource).doc! as unknown as {
    nodes: { styles: Record<string, Record<string, unknown>> }[];
    bind?: unknown;
    timelines?: unknown;
  };
  delete doc.bind;
  Reflect.deleteProperty(doc, 'inputs');
  doc.timelines = {
    weight: {
      duration: 1,
      tracks: {
        'label.styles.s.axes.wght': [
          [0, 400],
          [1, 900],
        ],
      },
    },
  };
  Object.assign(doc, {
    machine: { layers: { main: { initial: 'weight', states: { weight: { play: 'weight' } } } } },
  });
  const result = load(doc);
  expect(result.diagnostics).toEqual([]);
  const p = new Player(result.model!);
  p.step(0.5);
  expect(textLayout(p, 0).lines[0]!.clusters[0]!.font.axes).toEqual({ wght: 650 });
  expect(doc.nodes[0].styles.s.axes).toEqual({ wght: 400 });
});
it.each([
  ['axes', { bad: 1 }, 'bad-name', '/nodes/0/styles/s/axes/bad'],
  ['axes', { wght: 'bad' }, 'type', '/nodes/0/styles/s/axes/wght'],
  ['features', { liga: -1 }, 'bad-value', '/nodes/0/styles/s/features/liga'],
  ['features', { liga: 0.5 }, 'bad-value', '/nodes/0/styles/s/features/liga'],
])('diagnoses authored %s tags/values at the exact pointer', (field, value, code, pointer) => {
  const doc = compile(axisSource).doc! as unknown as {
    nodes: { styles: Record<string, Record<string, unknown>> }[];
    bind?: unknown;
    timelines?: unknown;
  };
  doc.nodes[0].styles.s[field] = value;
  const result = load(doc);
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code, pointer, message: expect.any(String) }),
  );
});
it('rejects unknown actual font axes instead of silently measuring the default', () => {
  const tool = measurer();
  expect(() =>
    tool.measure(
      { family: 'body', size: 2, weight: 400, style: 'normal', tracking: 0, axes: { nope: 1 } },
      'A',
    ),
  ).toThrow(expect.objectContaining({ code: 'font-axis', hint: expect.any(String) }));
});

it('preserves style features in tool SVG when glyph axes also draw', () => {
  measurer();
  const built = compile(
    `<anima version="0.1" name="options-effect" grid="20" requires="text fonts texteffects"><text id="label"><style id="s" font="body" features='{&quot;kern&quot;:0}'/><run text="AV" style="s"/><text-effect axes='{&quot;wght&quot;:700}'/></text></anima>`,
  );
  expect(built.diagnostics).toEqual([]);
  const result = load(built.doc!);
  expect(result.diagnostics).toEqual([]);
  const player = new Player(result.model!);
  player.step(0);
  expect(toSVG(player)).toContain('font-feature-settings:&quot;kern&quot; 0');
});
