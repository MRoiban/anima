import type { Player } from '../../../packages/core/src/player.ts';
import type { Model } from '../../../packages/core/src/load.ts';
import type { Diags } from '../../../packages/core/src/diag.ts';
import { ptr } from '../../../packages/core/src/diag.ts';
import { nodePointer } from '../../components/core/node-pointer.ts';
import { apply, invert } from '../../../packages/core/src/geom.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
export const handles = {
  read(p: Player, i: number) {
    if (p.model.nodes[i]!.raw.handle === undefined) return;
    const h = p.model.ids.get(p.model.nodes[i]!.raw.handle)!,
      inverse = invert(p.world(i));
    const rest = p.model.nodes[h]!.raw.pivot ?? [0, 0];
    const pivot = p.playbackPolicy?.pivot(p, h) ?? rest;
    return inverse
      ? apply(inverse, ...apply(p.world(h), ...(pivot as [number, number])))
      : undefined;
  },
  validate(model: Model, pads: number[], d: Diags) {
    for (const i of pads) {
      const n = model.nodes[i]!,
        r = n.raw,
        at = nodePointer(model, i);
      if (!model.ids.has(r.handle))
        d.err(
          'posepad-handle',
          at + '/handle',
          V && 'unknown handle node',
          V && 'name an existing node',
        );
      if (!r.box)
        d.err(
          'posepad-box',
          at + '/box',
          V && 'handle needs a box',
          V && 'add [x0, y0, width > 0, height > 0]',
        );
      const outputs = ['valueX', 'valueY'].map((key) => n.id + '.' + key);
      const check = (map: object, path: string) => {
        for (const address of Object.keys(map))
          if (outputs.includes(address))
            d.err(
              'posepad-output',
              ptr(path, address),
              V && 'handle-driven values are outputs',
              V && 'drive the handle instead',
            );
      };
      for (const [name, t] of Object.entries(model.doc.timelines ?? {}))
        check((t as { tracks?: object }).tracks ?? {}, ptr('/timelines', name) + '/tracks');
      check(model.doc.bind ?? {}, '/bind');
      for (const layer of model.layers)
        for (const state of layer.states)
          if (state.pose)
            check(
              Object.fromEntries(state.pose),
              ptr(ptr('/machine/layers', layer.name) + '/states', state.name) + '/pose',
            );
      const dependencies = new Set<number>(),
        visit = (j: number) => {
          if (j < 0 || dependencies.has(j)) return;
          dependencies.add(j);
          const node = model.nodes[j]!;
          visit(node.parent);
          for (const c of node.raw.constraints ?? [])
            for (const key of ['from', 'to', 'target', 'path', 'viewport', 'scroll', 'track']) {
              const target = model.ids.get(c[key]);
              if (target !== undefined) visit(target);
            }
        };
      const h = model.ids.get(r.handle);
      if (h !== undefined) visit(h);
      visit(i);
      for (const axis of ['X', 'Y']) {
        const t = model.timelines.find((t) => t.name === r['timeline' + axis]);
        if (t?.tracks.some((tr) => dependencies.has(model.addrs.get(tr.addr)!.node)))
          d.err(
            'posepad-cycle',
            at + '/timeline' + axis,
            V && 'pad timeline writes a handle dependency or pad frame',
            V && 'pose nodes independent of the handle and pad frame',
          );
      }
      for (const key of outputs)
        model.addrs.set(key, {
          node: i,
          key: key.slice(n.id.length + 1),
          prop: { type: 'number', min: -1, max: 1 },
          rest: 0,
        });
    }
  },
};
