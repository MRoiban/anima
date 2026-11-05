import { describe, expect, it } from 'vitest';
import {
  FEATURES,
  load,
  Player,
  registerModule,
  registerSVGBackend,
  sceneTree,
  type DrawNode,
  drawTree,
  drawFrame,
  toSVG,
  type Module,
} from '../src/index.ts';
import { paint } from '../src/modules/paint/index.ts';

interface ProbeDraw extends DrawNode {
  extra?: number;
}
const doc = { anima: '0.1', name: 'module', grid: 20, nodes: [{ id: 'a', type: 'group' }] };

describe('module registration', () => {
  it.each(['', 'Paint', 'two-words', 'paint@0'])('rejects invalid module name %s', (name) => {
    expect(() => registerModule({ name, entries: [] })).toThrow('invalid module name');
  });
  it('requires checks the runtime registry before inspecting module keys', () => {
    expect(
      load({ ...doc, requires: ['paint'], nodes: [{ ...doc.nodes[0], future: true }] }).diagnostics,
    ).toEqual([expect.objectContaining({ code: 'unknown-feature', pointer: '/requires/0' })]);
    registerModule(paint);
    expect(load({ ...doc, requires: ['paint'] }).model).toBeDefined();
  });

  it('supports registry entries, load/model/draw hooks and ordinary sampling', () => {
    const counts = { load: 0, model: 0, tree: 0, frame: 0 };
    const module: Module = {
      name: 'probe',
      entries: [
        {
          target: 'group',
          shapes: { extra: { k: 'num' } },
          props: { extra: { type: 'number', def: 1 } },
        },
      ],
      load(model, raw, diag) {
        counts.load++;
        expect(model.doc).toBe(raw);
        if (model.nodes[0]!.raw.extra < 0)
          diag.err('bad-value', '/nodes/0/extra', 'extra must be nonnegative', 'use zero or more');
      },
      model(node, key) {
        if (key !== 'extra') return;
        counts.model++;
        return { prop: { type: 'number', feature: 'probe', def: 1 }, rest: node.raw.extra ?? 1 };
      },
      draw: {
        tree(_model, tree) {
          counts.tree++;
          expect(tree.nodes[0]!.kind).toBe('group');
          tree.resources.push({ node: 0, kind: 'probe' });
        },
        frame(player, node, data) {
          counts.frame++;
          (data as ProbeDraw).extra = player.num(node, 'extra', 1);
        },
      },
    };
    registerModule(module);
    registerModule(module);
    registerSVGBackend('probe', {
      tree(draw, tree) {
        for (const resource of draw.resources)
          if (resource.kind === 'probe')
            tree.defs.push({ role: 'module:probe', tag: 'g', node: resource.node, kids: [] });
      },
      attrs(frame, el, _paint, id, attrs) {
        if (el.role === 'module:probe') attrs.id = id + (frame.nodes[el.node] as ProbeDraw).extra;
      },
    });
    expect(FEATURES.filter((f) => f === 'probe')).toHaveLength(1);
    const raw = {
      ...doc,
      requires: ['probe'],
      nodes: [{ ...doc.nodes[0], extra: 1 }],
      timelines: {
        t: {
          duration: 1,
          tracks: {
            'a.extra': [
              [0, 1],
              [1, 3],
            ],
          },
        },
      },
      machine: { layers: { l: { initial: 's', states: { s: { play: 't' } } } } },
    };
    const result = load(raw);
    expect(result.diagnostics).toEqual([]);
    const p = new Player(result.model!);
    p.step(0.5);
    expect(p.value('a.extra')).toBe(2);
    expect(drawTree(p.model).nodes).toHaveLength(1);
    expect((drawFrame(p).nodes[0] as ProbeDraw).extra).toBe(2);
    expect(sceneTree(p.model).defs.at(-1)?.role).toBe('module:probe');
    expect(toSVG(p)).toContain('<g id="a2"/>');
    expect(Object.values(counts).every((n) => n > 0)).toBe(true);
    expect(load({ ...raw, nodes: [{ ...doc.nodes[0], extra: -1 }] }).model).toBeUndefined();
    expect(load({ ...raw, requires: [] }).diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'undeclared-feature',
        pointer: '/nodes/0/extra',
        hint: 'add "probe" to "requires"',
      }),
    );
  });

  it('a versioned registration also accepts the base feature', () => {
    registerModule({ name: 'future@2', entries: [] });
    expect(load({ ...doc, requires: ['future'] }).model).toBeDefined();
    expect(load({ ...doc, requires: ['future@2'] }).model).toBeDefined();
    expect(load({ ...doc, requires: ['future@3'] }).model).toBeUndefined();
  });
});
