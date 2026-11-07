import type { Player } from '../../../packages/core/src/player.ts';
import { modules } from '../../../packages/core/src/modules.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import type { TextModule } from './index.ts';
export type TextRunAccess = (
  player: Player,
  node: string,
  run: string | number,
  value?: string,
) => string | undefined;
/** Optional legacy host editing; data-bound text does not pay for this state. */
export function createTextRunAccess(module: TextModule): TextRunAccess {
  if (module.textRun) return module.textRun;
  const overrides = new WeakMap<Player, Map<string, string>>();
  const key = (node: number, run: string | number) => node + ':' + typeof run + ':' + run;
  const previous = module.override;
  module.override = (p, i, run) => overrides.get(p)?.get(key(i, run)) ?? previous?.(p, i, run);
  return (module.textRun = (p, node, run, value) => {
    const ancestors: [Player, number][] = [];
    const path = node.split(/[/.]/);
    while (path.length > 1) {
      const name = path.shift()!;
      ancestors.push([p, p.model.ids.get(name)!]);
      const child = (p.nested as { players?: Map<string, Player> } | undefined)?.players?.get(name);
      if (!child) return;
      p = child;
    }
    const i = p.model.ids.get(path[0]!);
    if (i === undefined || String(p.model.nodes[i]!.type) !== 'text') return;
    const input = module.input(p, i),
      index = input.runs.findIndex((r, ri) =>
        typeof run === 'number' ? ri === run : r.id === run,
      );
    if (index < 0) return;
    if (value !== undefined) {
      if (typeof value !== 'string')
        throw new TypeError(V ? 'anima: text-run requires a string' : 'text-run');
      let state = overrides.get(p);
      if (!state) overrides.set(p, (state = new Map()));
      state.set(key(i, input.runs[index]!.id ?? index), value);
      module.invalidateText(p);
      for (const [parent, index] of ancestors) parent.drawVersions[index] = ++parent.drawRevision;
    }
    return value ?? input.runs[index]!.text;
  });
}
export function textRun(
  player: Player,
  node: string,
  run: string | number,
  value?: string,
): string | undefined {
  const text = modules.get('text') as TextModule | undefined;
  return text && createTextRunAccess(text)(player, node, run, value);
}
