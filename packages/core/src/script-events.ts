// Tooling adapter for the legacy machine policy, whose public events seam retains raw intervals.
// P3b-4 owns that runtime; capture attaches metadata here without changing its source or bundle.
import { MachinePolicy } from '../../../modules/machine/core/runtime.ts';
import { crossings } from '../../../modules/motion/core/clock.ts';
import { capture, occurrence, stampEntryEvent, type CapturedEvent } from './event-capture.ts';
import type { AnimaEvent } from './player.ts';
export function captureStep<T>(op: () => T): T {
  const original = MachinePolicy.prototype.events;
  MachinePolicy.prototype.events = function (t, a, b, closed, layer, out, speed, run, source) {
    const before = out.length;
    original.call(this, t, a, b, closed, layer, out, speed, run, source);
    if (!this.base) {
      const timed: AnimaEvent[] = [];
      crossings(t, a * speed, b * speed, closed, layer, timed, t.loop, source);
      for (let i = before; i < out.length; i++) {
        const e = out[i] as CapturedEvent;
        e[occurrence] = (timed[i - before] as CapturedEvent | undefined)?.[occurrence] ?? 0;
        if (closed) stampEntryEvent(e, (e[occurrence]! - 1) * (b - a));
      }
    }
  };
  try {
    return capture(op);
  } finally {
    MachinePolicy.prototype.events = original;
  }
}
