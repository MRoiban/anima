// The command language of `anima sample` and the conformance suite (spec §11.2). Tooling only.

import type { TimelineInstance } from '../../../modules/motion/core/api.ts';
import type { Model } from './load.ts';
import { type AnimaEvent, Player } from './player.ts';

export interface Snapshot {
  time: number;
  values: Record<string, number | boolean | string>;
  states: Record<string, string>;
  events: AnimaEvent[];
  settled: boolean;
}

export class ScriptError extends Error {
  readonly line: number;
  constructor(message: string, line: number) {
    super(`line ${line}: ${message}`);
    this.line = line;
  }
}

/** Run a script against a fresh player. Returns one snapshot per `snapshot` command. */
export function runScript(
  model: Model,
  text: string,
  opts: { reducedMotion?: boolean } = {},
): { snapshots: Snapshot[]; player: Player } {
  const p = new Player(model, opts);
  const out: Snapshot[] = [];
  const instances = new Map<string, TimelineInstance>();
  let events: AnimaEvent[] = [];
  let settled = false;
  const step = (dt: number) => {
    const r = p.step(dt);
    events.push(...r.events);
    settled = r.settled;
  };
  text.split('\n').forEach((raw, i) => {
    const line = i + 1;
    const words = raw.replace(/#.*/, '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;
    const [cmd, ...args] = words;
    const num = (s: string | undefined, what: string) => {
      const n = Number(s);
      if (s === undefined || !Number.isFinite(n))
        throw new ScriptError(`${what} must be a number`, line);
      return n;
    };
    try {
      switch (cmd) {
        case 'advance': {
          const t = num(args[0], 'advance time');
          if (t < 0) throw new ScriptError('advance time must be ≥ 0', line);
          let n = 1;
          if (args.length > 1) {
            if (args[1] !== 'in' || args.length !== 3)
              throw new ScriptError('use "advance <seconds> [in <n>]"', line);
            n = num(args[2], 'step count');
            if (!Number.isInteger(n) || n < 1)
              throw new ScriptError('step count must be a whole number ≥ 1', line);
          }
          for (let k = 0; k < n; k++) step(t / n);
          break;
        }
        case 'set': {
          if (args.length !== 2) throw new ScriptError('use "set <input> <value>"', line);
          const v = args[1] === 'true' ? true : args[1] === 'false' ? false : num(args[1], 'value');
          p.set(args[0]!, v);
          break;
        }
        case 'fire':
        case 'toggle':
          if (args.length !== 1) throw new ScriptError(`use "${cmd} <input>"`, line);
          if (cmd === 'fire') p.fire(args[0]!);
          else p.toggle(args[0]!);
          break;
        case 'pointer': {
          const kind = args[0];
          if (kind === 'leave') {
            p.pointer('leave');
            step(0);
            break;
          }
          if (!['move', 'down', 'up', 'click'].includes(kind!) || args.length !== 3)
            throw new ScriptError(
              'use "pointer move|down|up|click <x> <y>" or "pointer leave"',
              line,
            );
          const x = num(args[1], 'x');
          const y = num(args[2], 'y');
          for (const k of kind === 'click'
            ? (['move', 'down', 'up'] as const)
            : [kind as 'move' | 'down' | 'up']) {
            p.pointer(k, x, y);
            step(0);
          }
          break;
        }
        case 'instance': {
          if (args.length < 2 || args.length > 3)
            throw new ScriptError('use "instance <id> <timeline> [mix]"', line);
          instances.set(
            args[0]!,
            p.createTimeline(args[1]!, {
              name: args[0]!,
              mix: args[2] === undefined ? 1 : num(args[2], 'mix'),
            }),
          );
          break;
        }
        case 'timeline': {
          const name = args[0]!,
            op = args[1];
          const t = instances.get(name) ?? p.timeline(name);
          if (op === 'play' || op === 'pause' || op === 'stop') t[op]();
          else if (op === 'seek' || op === 'scrub') t[op](num(args[2], op));
          else if (op === 'speed' || op === 'mix') t[op] = num(args[2], op);
          else if (op === 'loop' && ['once', 'loop', 'pingpong', 'authored'].includes(args[2]!))
            t.loop = args[2] === 'authored' ? null : (args[2] as TimelineInstance['loop']);
          else
            throw new ScriptError(
              'use "timeline <name> play|pause|stop|seek|scrub|speed|mix|loop [value]"',
              line,
            );
          break;
        }
        case 'machine': {
          const m = p.machine(args[0]!),
            op = args[1];
          if (op === 'play' || op === 'pause' || op === 'stop') m[op]();
          else if (op === 'mix') m.mix = num(args[2], 'mix');
          else if (op === 'fire') m.fire(args[2]!);
          else if (op === 'set')
            m.set(
              args[2]!,
              args[3] === 'true' ? true : args[3] === 'false' ? false : num(args[3], 'value'),
            );
          else
            throw new ScriptError(
              'use "machine <name> play|pause|stop|mix|fire|set [value …]"',
              line,
            );
          break;
        }
        case 'motion':
          if (args[0] !== 'reduce' && args[0] !== 'full')
            throw new ScriptError('use "motion reduce|full"', line);
          p.reducedMotion = args[0] === 'reduce';
          break;
        case 'snapshot': {
          let values = p.values();
          if (args.length) {
            const pick: typeof values = {};
            for (const a of args) {
              const v = p.get(a) ?? p.value(a);
              if (v === undefined)
                throw new ScriptError(
                  `"${a}" is not an animated address or a bool/number input`,
                  line,
                );
              pick[a] = v;
            }
            values = pick;
          }
          out.push({ time: p.time, values, states: p.states(), events, settled });
          events = [];
          break;
        }
        default:
          throw new ScriptError(`unknown command "${cmd}"`, line);
      }
    } catch (e) {
      if (e instanceof ScriptError) throw e;
      throw new ScriptError((e as Error).message.replace(/^anima: /, ''), line);
    }
  });
  return { snapshots: out, player: p };
}
