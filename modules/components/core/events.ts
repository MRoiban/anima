import type { Module } from '../../../packages/core/src/modules.ts';

/** Scene event kinds are distinct from dotted component output addresses. */
export type EventKinds = Map<string, string | undefined>;
export type EventModule = Module & { eventKinds: EventKinds };
export function registerEventKinds(
  modules: ReadonlyMap<string, Module>,
  feature: string,
  names: readonly string[],
): void {
  const component = modules.get('components') as EventModule | undefined;
  for (const name of names) component?.eventKinds.set(name, feature);
}
