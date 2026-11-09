import type { Module } from '../../../packages/core/src/modules.ts';
import type { Model, Value } from '../../../packages/core/src/load.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import { clamp } from '../../../packages/core/src/geom.ts';
import { formatHex } from '../../../packages/core/src/color.ts';
import { after } from '../manifest.ts';
import { entries } from './registry.ts';
import { nodePointer } from '../../components/core/node-pointer.ts';
import { handles } from './handle.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
export interface PosePadModule extends Module {
  handles?: typeof handles;
}

declare module '../../../packages/core/src/load.ts' {
  interface Model {
    rigPose?: (p: Player) => boolean;
  }
}
let sample: typeof import('../../../packages/core/src/player.ts').sampleTrack;
const states = new WeakMap<Player, Map<string, Value>>();
function overlay(p: Player) {
  let values = states.get(p);
  if (!values) {
    states.set(p, (values = new Map()));
    const prop = p.prop.bind(p),
      value = p.value.bind(p);
    p.prop = (i, k) => values!.get(p.model.nodes[i]!.id + '.' + k) ?? prop(i, k);
    p.value = (a) => {
      const v = values!.get(a) ?? value(a);
      return Array.isArray(v) ? formatHex(v) : v;
    };
  }
  return values;
}
export const posepad: PosePadModule = {
  name: 'posepad',
  after,
  entries,
  init(_modules, shared) {
    sample = shared.sampleTrack;
    if (V) posepad.handles = handles;
    return posepad;
  },
  draw: {
    tree(model, tree) {
      model.nodes.forEach((n, i) => {
        if ((n.type as string) === 'posepad') tree.nodes[i]!.kind = 'group';
      });
    },
  },
  load(model: Model, _raw, d) {
    if (!model.doc.requires?.includes('posepad')) return;
    const pads = model.nodes.flatMap((n, i) => ((n.type as string) === 'posepad' ? [i] : []));
    const timelines = pads.map((i) => {
      const raw = model.nodes[i]!.raw;
      if (raw.handle !== undefined) {
        if (posepad.handles) posepad.handles.validate(model, [i], d);
        else
          d.err(
            'posepad-handle',
            nodePointer(model, i) + '/handle',
            V && 'handle support is not installed',
            V && 'import @anima-format/web/posepad-handle',
          );
      }
      return ['X', 'Y'].map((axis) => {
        const name = raw['timeline' + axis],
          timeline = model.timelines.find((t) => t.name === name);
        if (name !== undefined && !timeline)
          d.err(
            'posepad-timeline',
            nodePointer(model, i) + '/timeline' + axis,
            V && 'unknown timeline',
            V && 'name a declared timeline',
          );
        return timeline;
      });
    });
    const pose = (p: Player) => {
      const values = overlay(p);
      values.clear();
      for (const [index, i] of pads.entries()) {
        const r = model.nodes[i]!.raw,
          point = posepad.handles?.read(p, i);
        for (const [a, axis] of ['X', 'Y'].entries()) {
          const v = clamp(
            point ? (2 * (point[a]! - r.box[a])) / r.box[a + 2] - 1 : p.num(i, 'value' + axis, 0),
            -1,
            1,
          );
          values.set(model.nodes[i]!.id + '.value' + axis, v);
          const timeline = timelines[index]![a];
          for (const tr of timeline?.tracks ?? []) {
            const addr = model.addrs.get(tr.addr)!,
              sampled = sample(
                tr,
                (((r['invert' + axis] ? -v : v) + 1) / 2) * timeline!.duration,
                p,
              );
            values.set(
              tr.addr,
              typeof sampled === 'number'
                ? clamp(sampled, addr.prop.min ?? -Infinity, addr.prop.max ?? Infinity)
                : sampled,
            );
            p.drawVersions[addr.node] = ++p.drawRevision;
          }
        }
      }
      return !!values.size;
    };
    const stage = model.doc.requires.includes('rig') ? 'rigPose' : 'afterStep',
      previous = model[stage];
    model[stage] = (p) => {
      const wrote = previous?.(p);
      return pose(p) || !!wrote;
    };
  },
};
