import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
type Stats = { fps: number; frameMs: number; frames: number };
const samples = new WeakMap<AnimaIcon, [number, number][]>();
const read = (icon: AnimaIcon) => {
  const list = samples.get(icon) ?? [];
  const cutoff = performance.now() - 1000;
  while (list.length && list[0]![0] <= cutoff) list.shift();
  return list;
};
Object.defineProperty(Icon.prototype, 'stats', {
  get(this: AnimaIcon): Stats {
    const list = read(this);
    return {
      fps: list.length,
      frameMs: list.reduce((sum, s) => sum + s[1], 0) / (list.length || 1),
      frames: list.length,
    };
  },
});
const frame = Icon.prototype.frame;
Icon.prototype.frame = function (now) {
  const start = performance.now();
  const marks = this.perfMarks || this.hasAttribute('perf');
  const mark = marks ? performance.mark('anima:frame:start') : undefined;
  try {
    frame.call(this, now);
  } finally {
    if (mark) {
      performance.measure('anima:frame', { start: mark.startTime, end: performance.now() });
      performance.clearMarks('anima:frame:start');
    }
    const list = read(this);
    list.push([performance.now(), performance.now() - start]);
    samples.set(this, list);
  }
};
Icon.warnings = 'once';
const warned = new Set<string>();
Icon.warn = (code, message) => {
  if (Icon.warnings === 'off' || (Icon.warnings === 'once' && warned.has(code))) return;
  warned.add(code);
  console.warn(message);
};
declare module '../../../packages/web/src/index.ts' {
  // Ambient merging adds optional static types without adding bytes to the base runtime.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace AnimaIcon {
    let warnings: 'once' | 'always' | 'off';
    function warn(code: string, message: string): void;
  }
  interface AnimaIcon {
    readonly stats: Stats;
    perfMarks: boolean;
  }
}
