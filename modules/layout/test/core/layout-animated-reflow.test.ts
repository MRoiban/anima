import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import '../../../../packages/core/src/all.ts';
import {
  load,
  Player,
  drawFrame,
  parseEase,
  jsonSchema,
} from '../../../../packages/core/src/index.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
import { resolveLayout } from '../../core/index.ts';
import { documentFonts, installToolMeasurer } from '../../../../packages/cli/src/font/document.ts';
const rect = (id: string, extra: object = {}) => ({
  id,
  type: 'rect',
  x0: 0,
  y0: 0,
  w: 2,
  h: 2,
  fill: { color: '#000' },
  ...extra,
});
function create(
  extra: object = {},
  children: unknown[] = [rect('child', { layout: { width: 'fill' } })],
  features: string[] = [],
) {
  const doc = {
    anima: '0.1',
    name: 'reflow',
    grid: 20,
    requires: ['layout', 'bind', ...features],
    inputs: { w: { type: 'number', default: 10 } },
    bind: { 'root.width': 'w' },
    nodes: [
      { id: 'root', type: 'layout', width: 10, height: 4, reflow: '1 linear', children, ...extra },
    ],
  };
  const r = load(doc);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  p.step(0);
  return p;
}
it('keeps targets immediate, advances drawn boxes, retargets at current time, and settles exactly at completion', () => {
  const p = create();
  expect(p.step(0).settled).toBe(true);
  p.set('w', 18);
  expect(p.step(0).settled).toBe(false);
  expect(p.layoutBox('root')!.width).toBe(18);
  expect(p.drawnLayoutBox('root')!.width).toBe(10);
  p.step(0.5);
  expect(p.drawnLayoutBox('root')!.width).toBe(14);
  expect(drawFrame(p).nodes[0]!.geometry!.width).toBe(14);
  p.set('w', 6);
  p.step(0.25);
  expect(p.drawnLayoutBox('root')!.width).toBe(16);
  p.step(0.5);
  expect(p.drawnLayoutBox('root')!.width).toBe(11);
  expect(p.step(0.5).settled).toBe(true);
  expect(p.drawnLayoutBox('root')!.width).toBe(6);
  const revision = p.drawRevision;
  resolveLayout(p);
  expect(p.drawRevision).toBe(revision);
  const copy = p.drawnLayoutBox('root')!;
  copy.width = 100;
  expect(p.drawnLayoutBox('root')!.width).toBe(6);
  expect(p.drawnLayoutBox('missing')).toBeUndefined();
});
it('inherits settings through containers, honors per-child override and zero, and moves hit/world geometry', () => {
  const p = create({ justify: 'end' }, [
    { id: 'nested', type: 'layout', width: 4, height: 4, children: [rect('inner')] },
    rect('fast', { layout: { reflow: '0.5 out' } }),
    rect('snap', { layout: { reflow: 0 } }),
  ]);
  p.set('w', 18);
  p.step(0);
  p.step(0.25);
  expect(p.drawnLayoutBox('nested')!.x).toBe(4);
  expect(p.world(1)[4]).toBe(4);
  const ease = parseEase('out') as (u: number) => number;
  expect(p.drawnLayoutBox('fast')!.x).toBeCloseTo(6 + 8 * ease(0.5));
  expect(p.drawnLayoutBox('snap')!.x).toBe(16);
  expect(p.local(3)[4]).toBeCloseTo(p.drawnLayoutBox('fast')!.x);
});
it('a nested container child override controls its own box while its container setting reaches descendants', () => {
  const p = create({}, [
    {
      id: 'nested',
      type: 'layout',
      height: 4,
      layout: { width: 'fill', reflow: 0 },
      reflow: '1 linear',
      children: [rect('inner', { layout: { width: 'fill' } })],
    },
  ]);
  p.set('w', 18);
  p.step(0);
  p.step(0.5);
  expect(p.drawnLayoutBox('nested')!.width).toBe(18);
  expect(p.drawnLayoutBox('inner')!.width).toBe(14);
});
it.each(['hold', 'in', 'out', 'inOut', 'cubic(0.2,0.3,0.7,1)', 'elastic(1,0.3)'])(
  'uses the existing %s ease and reaches its exact endpoint',
  (ease) => {
    const p = create({ reflow: '1 ' + ease });
    p.set('w', 18);
    p.step(0);
    p.step(0.5);
    expect(p.drawnLayoutBox('root')!.width).toBeCloseTo(
      10 + 8 * (parseEase(ease) as (u: number) => number)(0.5),
    );
    expect(p.step(0.5).settled).toBe(true);
    expect(p.drawnLayoutBox('root')!.width).toBe(18);
  },
);
it.each(['elastic-in(1,0.3)', 'elastic-in-out(1,0.3)'])(
  'accepts the motion weight ease %s only with its feature declared',
  (ease) => {
    const p = create({ reflow: '1 ' + ease }, undefined, ['motion']);
    p.set('w', 18);
    p.step(0);
    p.step(0.5);
    expect(Number.isFinite(p.drawnLayoutBox('root')!.width)).toBe(true);
    expect(p.step(0.5).settled).toBe(true);
    const doc = { ...p.model.doc, requires: ['layout', 'bind'] };
    expect(load(doc).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'layout-reflow', pointer: '/nodes/0/reflow' }),
    );
  },
);
it('clamps elastic dimension undershoot at zero and still ends at the exact target', () => {
  const p = create({ reflow: '1 elastic(1,0.3)' });
  p.set('w', 1);
  p.step(0);
  p.step(0.15);
  expect(p.drawnLayoutBox('root')!.width).toBe(0);
  expect(drawFrame(p).nodes[0]!.geometry!.width).toBe(0);
  expect(p.step(0.85).settled).toBe(true);
  expect(p.drawnLayoutBox('root')!.width).toBe(1);
});
it('snaps active and new changes in reduced motion, without resuming stale flights', () => {
  const p = create();
  p.set('w', 18);
  p.step(0);
  p.step(0.25);
  p.reducedMotion = true;
  expect(p.step(0).settled).toBe(true);
  expect(p.drawnLayoutBox('child')!.width).toBe(18);
  p.set('w', 6);
  p.step(0);
  expect(p.drawnLayoutBox('root')!.width).toBe(6);
  p.reducedMotion = false;
  p.step(0.5);
  expect(p.drawnLayoutBox('root')!.width).toBe(6);
});
it('applies and clears host root overrides without mutating another player or the model', () => {
  const p = create({ reflow: 0 }),
    q = new Player(p.model);
  p.layoutSize = [40, 12];
  p.step(0);
  expect(p.layoutBox('root')).toEqual({ x: 0, y: 0, width: 40, height: 12 });
  expect(p.layoutBox('child')!.width).toBe(40);
  expect(q.layoutBox('root')!.width).toBe(10);
  p.layoutSize = undefined;
  p.step(0);
  expect(p.layoutBox('root')!.width).toBe(10);
});
it('compiles both spellings, decompiles, and exposes the reflow field in schema', () => {
  const src =
    '<anima version="0.1" name="reflow" grid="20" requires="layout"><layout id="root" width="20" reflow="0.25 out"><rect id="child" x0="0" y0="0" width="2" height="2" fill="#000" reflow="0.5 in"/></layout></anima>';
  const c = compile(src);
  expect(c.diagnostics).toEqual([]);
  const doc = JSON.parse(c.text!);
  expect(doc.nodes[0].reflow).toBe('0.25 out');
  expect(doc.nodes[0].children[0].layout.reflow).toBe('0.5 in');
  expect(compile(decompile(doc)).text).toBe(c.text);
  expect(JSON.stringify(jsonSchema())).toContain('reflow');
});
it.each([-1, '-1 linear', 'Infinity out', '0.5 unknown', '1 cubic(2,0,0,1)', ''])(
  'rejects invalid reflow %j with exact diagnostics',
  (reflow) => {
    for (const child of [false, true]) {
      const doc = {
        anima: '0.1',
        name: 'bad',
        grid: 20,
        requires: ['layout'],
        nodes: [
          {
            id: 'root',
            type: 'layout',
            ...(child ? {} : { reflow }),
            children: [rect('a', { layout: child ? { reflow } : {} })],
          },
        ],
      };
      const r = load(doc);
      expect(r.model).toBeUndefined();
      expect(r.diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'layout-reflow',
          pointer: child ? '/nodes/0/children/0/layout/reflow' : '/nodes/0/reflow',
          message: expect.any(String),
          hint: expect.any(String),
        }),
      );
    }
  },
);
it('measures and draws fill text wrapped at its allocation, including nested hug height, with the generated font', async () => {
  const path = 'modules/layout/examples/wrapped.animl';
  const c = compile(readFileSync(path, 'utf8'), { file: path });
  expect(c.diagnostics).toEqual([]);
  const doc = JSON.parse(c.text!),
    fonts = documentFonts(doc, path.replace('.animl', '.ani'));
  expect(fonts.diagnostics).toEqual([]);
  await installToolMeasurer(fonts.measurer);
  const r = load(doc);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  p.step(0);
  expect(p.layoutBox('label')!.width).toBe(6);
  expect(p.layoutBox('label')!.height).toBeGreaterThan(2);
  expect(p.layoutBox('nested')!.height).toBe(p.layoutBox('label')!.height);
  expect(p.layoutBox('root')!.height).toBe(p.layoutBox('label')!.height + 2);
  const frame = drawFrame(p);
  const t = frame.nodes[
    p.model.ids.get('label')!
  ] as import('../../../text/core/index.ts').TextDrawNode;
  expect(t.text!.layout.lines.length).toBeGreaterThan(1);
  expect(t.text!.layout.height).toBe(p.layoutBox('label')!.height);
  const revision = p.drawRevision;
  resolveLayout(p);
  resolveLayout(p);
  expect(p.drawRevision).toBe(revision);
});
// P7 benchmark: reflow and the host data API both wrap `busy`; a data write mid-reflow must not throw
// "Cannot redefine property: busy", and busy must stay true while a flight runs.
it('chains busy with the host data API so data writes during a reflow work', async () => {
  const path = 'modules/layout/examples/reflow.animl';
  const source = readFileSync(path, 'utf8').replace(
    'requires="layout text assets fonts data bind"',
    'requires="layout text assets fonts data bind host"',
  );
  const c = compile(source, { file: path });
  expect(c.diagnostics).toEqual([]);
  const doc = JSON.parse(c.text!),
    fonts = documentFonts(doc, path.replace('.animl', '.ani'));
  await installToolMeasurer(fonts.measurer);
  const r = load(doc);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const { runScript } = await import('../../../../packages/core/src/index.ts');
  const run = () =>
    runScript(
      r.model!,
      'advance 0\ndata set $label "Go further"\nadvance 0.1\ndata set $label "Go"',
    );
  expect(run).not.toThrow();
  const p = run().player;
  expect(p.busy).toBe(true);
  p.step(1); // applies the queued write and starts its flight
  p.step(1);
  expect(p.busy).toBe(false);
});
