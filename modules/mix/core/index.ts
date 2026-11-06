// Blend refinements contribute renderer-neutral compositing data.
import type { Module } from '../../../packages/core/src/modules.ts';
import type { Shape } from '../../../packages/core/src/registry.ts';
import { after } from '../manifest.ts';
const modes =
  'normal multiply screen overlay darken lighten color-dodge color-burn hard-light soft-light difference exclusion hue saturation color luminosity additive'.split(
    ' ',
  );
const amount: Shape = { k: 'num', min: 0, max: 1 };
export const mix: Module = {
  name: 'mix',
  after,
  entries: [
    {
      target: 'node',
      shapes: {
        mix: { k: 'obj', p: { mode: { k: 'str', of: modes }, strength: amount }, req: ['mode'] },
      },
    },
    ...['fill', 'stroke'].map((target) => ({
      target,
      shapes: {
        blend: { k: 'str' as const, of: ['inherit', ...modes], markup: target + '-blend' },
        blendAmount: { ...amount, markup: target + '-blend-amount' },
      },
      props: { blendAmount: { type: 'number' as const, min: 0, max: 1, def: 1 } },
    })),
  ],
  model(n, key) {
    if (key === 'mix.strength' && n.raw.mix)
      return {
        prop: { type: 'number', min: 0, max: 1, feature: 'mix' },
        rest: n.raw.mix.strength ?? 1,
      };
  },
  load(model, _raw, d) {
    const paths: string[] = [],
      counts = new Map<number, number>();
    model.nodes.forEach((n, i) => {
      const j = counts.get(n.parent) ?? 0;
      counts.set(n.parent, j + 1);
      const pointer = (paths[i] =
        (n.parent < 0 ? '/nodes' : paths[n.parent] + '/children') + '/' + j);
      if (n.raw.mix && n.raw.blend)
        d.err(
          'paint-conflict',
          pointer + '/mix',
          'mix replaces node blend',
          'choose one node compositing declaration',
        );
    });
  },
  draw: {
    tree(model, tree) {
      const paths: string[] = [],
        counts = new Map<number, number>();
      model.nodes.forEach((n, node) => {
        const j = counts.get(n.parent) ?? 0;
        counts.set(n.parent, j + 1);
        paths[node] = (n.parent < 0 ? '/nodes' : paths[n.parent] + '/children') + '/' + j;
        tree.nodes[node]!.pointer = paths[node];
        const paints = n.raw.paints?.map(
          (p: { fill?: object; stroke?: object }) => p.fill ?? p.stroke,
        ) ?? [n.raw.fill, n.raw.stroke];
        if (
          paints.some(
            (p: { blend?: string; blendAmount?: number } | undefined) =>
              p?.blend !== undefined || p?.blendAmount !== undefined,
          )
        )
          tree.resources.push({ node, kind: 'mix-paints' });
      });
    },
    frame(p, i, data) {
      const raw = p.model.nodes[i]!.raw;
      data.world = p.world(i);
      if (raw.mix) {
        data.blend = raw.mix.mode;
        data.blendAmount = p.num(i, 'mix.strength', 1);
      }
      const override = data.paints.some((paint) =>
        ['blend', 'blendAmount'].some(
          (key) =>
            (paint.key ?? paint.kind).split('.').reduce((o, k) => o?.[k], raw)?.[key] !== undefined,
        ),
      );
      if (override) {
        const inherit = data.blend ?? 'normal',
          amount = data.blendAmount ?? 1;
        for (const paint of data.paints) {
          const authored = (paint.key ?? paint.kind).split('.').reduce((o, k) => o?.[k], raw);
          paint.blend = authored.blend && authored.blend !== 'inherit' ? authored.blend : inherit;
          paint.blendAmount = p.num(i, (paint.key ?? paint.kind) + '.blendAmount', amount);
        }
        data.blend = 'normal';
        data.blendAmount = 1;
      }
    },
  },
};
