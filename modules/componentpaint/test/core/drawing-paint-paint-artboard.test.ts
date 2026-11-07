import '../../../../packages/core/src/all.ts';
import { assets } from '../../../assets/core/index.ts';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { load, Player, drawFrame, toSVG } from '../../../../packages/core/src/index.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
const xml = readFileSync('modules/componentpaint/examples/live.animl', 'utf8');
function model(source = xml) {
  const built = compile(source);
  expect(built.diagnostics).toEqual([]);
  return load(built.doc!).model!;
}
function source(p: Player, index = 0) {
  return drawFrame(p).nodes[index]!.paints.find((p) => p.component)!.component!;
}
describe('component paint', () => {
  it('round-trips the registry spellings and renders live source geometry without a placeholder color', () => {
    const m = model(),
      p = new Player(m);
    expect(m.doc.nodes[0].fill).toEqual({ paint: 'component:row' });
    expect(compile(decompile(m.doc)).doc).toEqual(m.doc);
    p.step(0.5);
    expect(source(p).nodes[1]!.transform).toEqual([1, 0, -0, 1, 3, 0]);
    expect(toSVG(p)).toContain('<pattern');
    expect(toSVG(p)).toContain('viewBox="-2 -1 10 10"');
    expect(toSVG(p)).toContain('fill="url(#acp0)"');
  });
  it('isolates players, source resources and replay models, and keeps live fills awake', () => {
    const m = model(),
      a = new Player(m),
      b = new Player(m);
    expect(a.step(0.5).settled).toBe(false);
    expect(source(a).nodes[1]!.transform[4]).toBe(3);
    b.step(0);
    expect(source(b).nodes[1]!.transform[4]).toBe(0);
    const replay = new Player(a.model);
    replay.step(0.25);
    expect(source(replay).nodes[1]!.transform[4]).toBe(1.5);
    expect(source(a).nodes[1]!.transform[4]).toBe(3);
    expect(a.step(0.5).settled).toBe(true);
  });
  it('honors reduced motion on paint source playback', () => {
    const m = model(xml.replace('duration="1"', 'duration="1" reducedMotion="end"'));
    const p = new Player(m, { reducedMotion: true });
    p.step(0);
    expect(source(p).nodes[1]!.transform[4]).toBe(6);
    expect(p.step(0).settled).toBe(true);
  });
  it.each([
    ['paint="missing"', 'component-paint'],
    ['paint="component:missing"', 'unknown-component'],
    ['paint="component:row" fill="#000"', 'component-paint'],
  ])('diagnoses %s with a precise source pointer and hint', (attr, code) => {
    const result = compile(xml.replace('paint="component:row"', attr));
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        pointer: '/nodes/0/fill/paint',
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
  });
  it('diagnoses undeclared modules and cyclic sources', () => {
    expect(
      load({
        anima: '0.1',
        name: 'missing-components',
        grid: 20,
        requires: ['paint', 'componentpaint'],
        nodes: [
          {
            id: 'shape',
            type: 'rect',
            x0: 0,
            y0: 0,
            w: 10,
            h: 10,
            fill: { paint: 'component:row' },
          },
        ],
      }).diagnostics,
    ).toContainEqual(
      expect.objectContaining({ code: 'undeclared-feature', pointer: '/nodes/0/fill/paint' }),
    );
    const result = compile(xml.replace('fill="#204080"', 'paint="component:row"'));
    expect(
      result.diagnostics.some(
        (d) =>
          d.code === 'component-cycle' &&
          d.pointer === '/components/row/nodes/0/fill/paint' &&
          d.hint,
      ),
    ).toBe(true);
  });
  it('reports actual SVG source limits rather than falling back to a solid fill', () => {
    const m = model(
      xml
        .replace('fill="#204080"', '')
        .replace(
          '<rect id="background" x0="-2" y0="-1" width="10" height="10" />',
          '<rect id="background" x0="-2" y0="-1" width="10" height="10"><angularGradient x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></angularGradient></rect>',
        ),
    );
    expect(() => toSVG(new Player(m))).toThrowError(
      expect.objectContaining({
        code: 'unsupported-render',
        pointer: '/nodes/0/fill/paint',
        message: expect.stringContaining('angular'),
        hint: expect.stringContaining('canvas'),
      }),
    );
  });
});

it('loads nested paint dependencies without treating unrelated definitions as recursive sources', () => {
  const r = compile(
    xml
      .replace('fill="#204080"', 'paint="component:leaf"')
      .replace(
        '</component>',
        '</component><component name="leaf" grid="10"><rect id="leaf" x0="0" y0="0" width="10" height="10" fill="#00ff00"/></component>',
      ),
  );
  expect(r.diagnostics).toEqual([]);
  const p = new Player(load(r.doc!).model!);
  p.step(0);
  expect(toSVG(p).match(/<pattern/g)).toHaveLength(2);
  expect(toSVG(p)).toContain('#00ff00');
});

it('preserves a source draw-order override before its first step', () => {
  const doc = structuredClone(model().doc);
  doc.requires.push('composite');
  doc.components.row.nodes[0].drawOrder = { target: 'bar', position: 'after' };
  const p = new Player(load(doc).model!),
    svg = toSVG(p);
  expect(svg.indexOf('fill="#e08020"')).toBeLessThan(svg.indexOf('fill="#204080"'));
});

it('preserves resolved parent asset URLs when allocating a player-owned source tree', () => {
  const doc = structuredClone(model().doc);
  doc.requires.push('assets');
  doc.assets = { image: { type: 'image', source: 'relative.png' } };
  doc.nodes.push({ id: 'image', type: 'image', asset: 'image', x0: 0, y0: 0, width: 1, height: 1 });
  const result = load(doc);
  expect(result.diagnostics).toEqual([]);
  assets.resolvedAssets.set(result.model!, {
    image: { type: 'image', source: 'https://resolved.test/image.png' },
  });
  const p = new Player(result.model!);
  expect(drawFrame(p).nodes[1]!.geometry!.image!.source).toBe('https://resolved.test/image.png');
});
it('diagnoses registry-permitted ordered sources instead of silently drawing an empty fill', () => {
  const doc = structuredClone(model().doc);
  doc.requires.push('composite');
  doc.nodes[0].paints = [{ fill: doc.nodes[0].fill }];
  delete doc.nodes[0].fill;
  expect(load(doc).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'component-paint',
      pointer: '/nodes/0/paints/0/fill/paint',
      hint: expect.any(String),
    }),
  );
});

it('keeps a hidden fill hidden while its source clock continues to advance', () => {
  const doc = structuredClone(model().doc);
  doc.requires.push('composite');
  doc.nodes[0].fill.visible = false;
  const p = new Player(load(doc).model!);
  p.step(0.5);
  expect(source(p).nodes[1]!.transform[4]).toBe(3);
  const svg = toSVG(p).split('</defs>')[1]!;
  expect(svg).toContain('fill="none"');
  expect(svg).not.toContain('fill="url(');
});
