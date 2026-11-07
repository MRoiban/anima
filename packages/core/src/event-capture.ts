// Tooling metadata uses enumerable symbols so nested event copies preserve it; JSON stays unchanged.
// Call sites are guarded by VERBOSE and eliminated from shipped browser bundles.
import type { Model } from './load.ts';
import type { AnimaEvent } from './player.ts';
export let capturing = false;
const steps: number[] = [];
export function beginStep(dt: number): void {
  if (capturing) steps.push(dt);
}
export function endStep(): void {
  if (capturing) steps.pop();
}
export function stampEntryEvent(event: AnimaEvent, offset: number): AnimaEvent {
  const dt = steps.at(-1) ?? 0;
  return stampEvent(event, dt ? 1 + offset / dt : 0);
}
export function capture<T>(op: () => T): T {
  const previous = capturing;
  const depth = steps.length;
  capturing = true;
  try {
    return op();
  } finally {
    capturing = previous;
    steps.length = depth;
  }
}
export const occurrence = Symbol('anima event fraction');
export const eventSource = Symbol('anima event source');
export type CapturedEvent = AnimaEvent & { [occurrence]?: number; [eventSource]?: Model };
export function stampEvent(event: AnimaEvent, fraction: number): AnimaEvent {
  if (capturing) (event as CapturedEvent)[occurrence] = Number.isFinite(fraction) ? fraction : 0;
  return event;
}
