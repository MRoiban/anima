import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';
import { compile } from '@anima-format/markup';
import { diagnosticRange, highlight, layoutGraph, sampleTimeline } from '../src/pure.ts';

const bell = readFileSync(new URL('../../../examples/bell.animl', import.meta.url), 'utf8');
const options = {
  file: 'examples/bell.animl',
  resolve: (path: string) => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8'),
};
const model = () => load(compile(bell, options).doc!).model!;
describe('source diagnostics and syntax highlighting', () => {
  it('maps compiler line:column to the offending attribute, including CRLF', () => {
    const bad = bell.replace('fill="ink"', 'fil="ink"').replaceAll('\n', '\r\n');
    const d = compile(bad, options).diagnostics.find((d) => d.code === 'unknown-attribute')!;
    const [a, b] = diagnosticRange(bad, d);
    expect(bad.slice(a, b)).toBe('fil');
    expect(d.line).toBe(33);
    expect(d.column).toBe(51);
    expect(highlight(bad, [d])).toContain('<span class="a squig">fil</span>');
  });
  it('clamps missing and stale locations to source boundaries', () => {
    expect(diagnosticRange('abc\nx', { line: 99, column: 500 })).toEqual([5, 5]);
    expect(diagnosticRange('abc', {})).toEqual([0, 3]);
    expect(diagnosticRange('', {})).toEqual([0, 0]);
  });
  it('escapes markup, entities, quotes and inserted-looking span text', () => {
    const out = highlight('<path id="<span class=\'v\'> &amp;"/>');
    expect(out).toContain('<span class="t">path</span>');
    expect(out).toContain('<span class="a">id</span>');
    expect(out).toContain("&lt;span class='v'&gt; &amp;amp;");
    expect(out).not.toContain('<path');
  });
  it('keeps multiline comments highlighted without swallowing subsequent elements', () => {
    const out = highlight('<!-- <tag>\n x --> <bool name="on"/>');
    expect(out.match(/class="c"/g)).toHaveLength(2);
    expect(out).toContain('<span class="t">bool</span>');
    expect(out).toContain('<i>2</i>');
  });
});
describe('deterministic graph layout', () => {
  it('places bell states and transitions within viewBox without overlapping pills', () => {
    for (const layer of model().layers) {
      const g = layoutGraph(layer);
      expect(layoutGraph(layer)).toEqual(g);
      expect(g.edges).toHaveLength(layer.states.flatMap((s) => s.on).length);
      g.nodes.forEach((a, i) => {
        expect(a.x).toBeGreaterThan(0);
        expect(a.x + a.width).toBeLessThanOrEqual(g.width);
        expect(a.y + a.height).toBeLessThan(g.height);
        for (const b of g.nodes.slice(i + 1))
          expect(
            a.x + a.width <= b.x ||
              b.x + b.width <= a.x ||
              a.y + a.height <= b.y ||
              b.y + b.height <= a.y,
          ).toBe(true);
      });
    }
  });
  it('falls back to a vertical list for more than six states, including loops and disconnected states', () => {
    const layer = model().layers[0]!;
    const states = Array.from({ length: 8 }, (_, i) => ({
      ...layer.states[0]!,
      name: `state${i}`,
      on: [{ ...layer.states[0]!.on[0]!, to: i }],
    }));
    const g = layoutGraph({ ...layer, states });
    expect(new Set(g.nodes.map((n) => n.y)).size).toBe(8);
    expect(g.edges.every((e) => !e.path.includes('NaN'))).toBe(true);
    expect(g.height).toBeGreaterThan(500);
  });
});
describe('timeline scrub over rest pose', () => {
  it('matches actual core sampling at exact keys and resets unkeyed live poses', () => {
    const m = model(),
      live = new Player(m);
    live.set('hover', true);
    live.fire('ring');
    live.step(0.1);
    live.step(0.2);
    const before = live.values(),
      states = live.inspect();
    const doc = sampleTimeline(m, m.timelines[0]!, 0.116667);
    const p = new Player(load(doc).model!);
    expect(p.value('swing.rotate')).toBeCloseTo(17.1887, 5);
    expect(p.value('icon.scale')).toBe(1);
    expect(p.value('dot.scale')).toBe(0);
    expect(live.values()).toEqual(before);
    expect(live.inspect()).toEqual(states);
  });
  it('clamps endpoints, supports colour and boolean hold tracks', () => {
    const m = load({
      anima: '0.1',
      name: 'test',
      grid: 20,
      nodes: [{ type: 'circle', id: 'dot', center: [10, 10], r: 2, fill: { color: '#000000' } }],
      timelines: {
        t: {
          duration: 1,
          tracks: {
            'dot.visible': [
              [0, true],
              [0.5, false],
            ],
            'dot.fill.color': [
              [0, '#000000'],
              [1, '#ffffff'],
            ],
          },
        },
      },
    }).model!;
    const at = (t: number) => new Player(load(sampleTimeline(m, m.timelines[0]!, t)).model!);
    expect(at(-5).value('dot.fill.color')).toBe('#000000');
    expect(at(0.5).value('dot.fill.color')).toBe('#808080');
    expect(at(0.49).value('dot.visible')).toBe(true);
    expect(at(0.5).value('dot.visible')).toBe(false);
    expect(at(5).value('dot.fill.color')).toBe('#ffffff');
  });
});
