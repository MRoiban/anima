import type { Player } from './player.ts';
/** Portable uint32 LCG. Legacy callers keep their own default stream; an explicit seed unifies it. */
export class RandomSource {
  static current?: RandomSource;
  seed?: number;
  streams: Record<string, number> = {};
  reset(seed: number): void {
    this.seed = seed >>> 0;
    this.streams = {};
  }
  next(legacy = 1, stream = 'convert'): number {
    const key = this.seed === undefined ? stream : '';
    const n = (Math.imul(1664525, this.streams[key] ?? this.seed ?? legacy) + 1013904223) >>> 0;
    this.streams[key] = n;
    return n / 4294967296;
  }
}

/** Install once on the shared Player class, including independently loaded optional bundles. */
export function installRandom(PlayerClass: typeof Player): void {
  if (Object.getOwnPropertyDescriptor(PlayerClass.prototype, 'randomSource')) return;
  const sources = new WeakMap<Player, RandomSource>();
  Object.defineProperty(PlayerClass.prototype, 'randomSource', {
    get(this: Player) {
      // Nested players inherit the stepping root's source; an explicitly seeded player is a root.
      if (RandomSource.current && this.seed === undefined) return RandomSource.current;
      let source = sources.get(this);
      if (!source) {
        sources.set(this, (source = new RandomSource()));
        if (this.seed !== undefined) source.reset(this.seed);
      }
      return source;
    },
  });
  const step = PlayerClass.prototype.step;
  PlayerClass.prototype.step = function (...args) {
    const previous = RandomSource.current;
    if (this.randomSource.seed !== undefined) RandomSource.current = this.randomSource;
    try {
      return step.apply(this, args);
    } finally {
      RandomSource.current = previous;
    }
  };
}
