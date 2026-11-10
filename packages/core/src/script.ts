// seam(P8-5): preserve mesh point tuples alongside existing scalar/colour values.
import { installRandom } from './random.ts';
import { captureStep } from './script-events.ts';
import { occurrence, eventSource, type CapturedEvent } from './event-capture.ts';
import { traceWrites } from './script-writes.ts';
import { formatHex } from './color.ts';
// The command language of `anima sample` and the conformance suite (spec §11.2). Tooling only.

import { COMMON, OWN, PAINT, markupName } from './registry.ts';
import { semanticCommand } from '../../../modules/a11y/core/commands.ts';
import { inputCommand } from '../../../modules/input/core/commands.ts';
import type { TimelineInstance } from '../../../modules/motion/core/api.ts';
import { modules } from './modules.ts';
import { resolveAddress, type Model } from './load.ts';
import { type AnimaEvent, Player } from './player.ts';

export interface Snapshot {
  time: number;
  values: Record<string, number | boolean | string | [number, number]>;
  states: Record<string, string>;
  events: AnimaEvent[];
  settled: boolean;
  data?: Record<string, unknown>;
  semantics?: unknown;
}

export class ScriptError extends Error {
  readonly code: string;
  readonly pointer: string;
  readonly hint: string;
  readonly line: number;
  constructor(message: string, line: number, code = 'script-usage') {
    super(`line ${line}: ${message}`);
    this.code = code;
    this.hint =
      code === 'script-target'
        ? 'inspect declared inputs or run semantics before targeting a node; hidden nodes cannot receive semantic actions'
        : 'check the command syntax in spec §11.2';
    this.line = line;
    this.pointer = `/script/${line - 1}`;
  }
}

export interface ScriptOptions {
  reducedMotion?: boolean;
  all?: boolean;
  semantics?: boolean;
  seed?: number;
  /** Tooling events with absolute occurrence times and their declaring asset scope. */
  onEvents?: (events: CapturedEvent[]) => void;
}
export interface ScriptDiagnostic {
  code: string;
  pointer: string;
  message: string;
  hint: string;
  writer?: string[];
}
type Operation = (p: Player, instances: Map<string, TimelineInstance>) => void;
class Breakpoint extends Error {}

/** Persistent, tooling-only script interpreter. No browser runtime hooks are installed. */
export function createScriptSession(model: Model, opts: ScriptOptions = {}) {
  installRandom(Player);
  const p = new Player(model, opts);
  const out: Snapshot[] = [];
  const output: unknown[] = [];
  const diagnostics: ScriptDiagnostic[] = [];
  const instances = new Map<string, TimelineInstance>();
  const journal: { op: Operation; writer: string }[] = [];
  const watched = new Map<string, string | undefined>();
  const changedData = new Set<string>();
  const breaks = new Map<string, { value?: unknown }>();
  let events: AnimaEvent[] = [];
  let settled = false;
  let stopped = false;
  let line = 0;
  let writer = 'script';
  let lastWriter = writer;
  let seed = opts.seed;
  let replaying = false;
  // A running semantic command: its live mutations are replayed on breakpoint probes and journaled
  // as one operation (steps counts the session steps it has completed).
  let semantic: { cmd: string; args: string[]; steps: number } | undefined;
  const stop = {};
  const replaySemantic = (player: Player, cmd: string, args: string[], limit: number) => {
    let n = 0;
    try {
      semanticCommand(
        player,
        cmd,
        args,
        [],
        (dt) => {
          if (n++ >= limit) throw stop;
          player.step(dt);
        },
        () => ({}) as Snapshot,
      );
    } catch {
      // The stop sentinel, or the same failure the live command reported at this boundary.
    }
  };
  const groups: string[] = [];
  let expectedError: string | undefined;
  const targetError = (message: string) => {
    throw new ScriptError(message, line, 'script-target');
  };
  const requireInput = (name: string) => {
    // get resolves component-scoped inputs as well as root inputs.
    if (!model.inputs.has(name) && p.get(name) === undefined)
      targetError('no input "' + name + '"; inspect inputs before targeting them');
  };
  let dataWritten = false;
  const act = (op: Operation) => {
    op(p, instances);
    journal.push({ op, writer });
    lastWriter = writer;
  };
  const data = (player = p) => {
    if (!model.doc.requires?.includes('data') || !('data' in player))
      throw new Error('data commands need a document with data and the host module loaded');
    return player.data;
  };
  const dataPath = (path: string) => {
    if (model.inputs.has(path)) return model.inputs.get(path)!.name;
    const alias = [...model.inputs].find(
      ([name, input]) => name.startsWith('$') && !name.includes(':') && input.name.includes(':'),
    );
    return !path.includes(':') && alias ? alias[1].name.split(':')[0] + ':' + path.slice(1) : path;
  };
  const writeData = (player: Player, path: string, value: unknown): void => {
    const api = data(player),
      canonical = dataPath(path);
    const [instanceName, propertyPath] = canonical.slice(1).split(':');
    const instance = api.instances().find((item) => item.name === instanceName);
    const document = model.doc.data as import('../../../modules/data/core/types.ts').DataDocument;
    let properties = document.models[instance?.model ?? '']?.properties;
    let property: import('../../../modules/data/core/types.ts').Property | undefined;
    const keys = propertyPath?.split('.') ?? [];
    for (let i = 0; i < keys.length; i++) {
      property = properties?.[keys[i]!];
      if (property?.type === 'model-ref') properties = document.models[property.model!]?.properties;
      if (property?.type === 'list' && i + 1 < keys.length) {
        properties = document.models[property.of!]?.properties;
        i++;
      }
    }
    if (
      property?.type === 'model-ref' &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      const fields = (value as { values?: Record<string, unknown> }).values ?? value;
      for (const [key, item] of Object.entries(fields))
        writeData(player, canonical + '.' + key, item);
      return;
    }
    const method =
      property?.type === 'bool'
        ? 'boolean'
        : property?.type === 'asset-ref'
          ? property.assetType === 'image'
            ? 'image'
            : property.assetType === 'font'
              ? 'font'
              : 'string'
          : property?.type;
    if (
      !method ||
      ![
        'number',
        'string',
        'boolean',
        'enum',
        'color',
        'component',
        'list',
        'image',
        'font',
      ].includes(method)
    )
      throw new Error('unknown or non-writable data path ' + path);
    api[method as 'number'](canonical).set(value as never);
  };
  const dataValues = (player = p): Record<string, unknown> => {
    const api = data(player);
    const values: Record<string, unknown> = {};
    const defaultPrefix = dataPath('$__prefix').split(':')[0] + ':';
    const visit = (path: string, value: unknown, depth = 0): void => {
      values[path] = value;
      if (path.startsWith(defaultPrefix)) values['$' + path.slice(defaultPrefix.length)] = value;
      if (depth >= 32 || value === null || typeof value !== 'object') return;
      if (Array.isArray(value)) visit(path + '.length', value.length, depth + 1);
      for (const [key, child] of Object.entries(value)) visit(path + '.' + key, child, depth + 1);
    };
    for (const instance of api.instances()) {
      const def = api.models().find((m) => m.name === instance.model)!;
      for (const prop of def.properties) {
        if (prop.type === 'trigger') continue;
        const path = '$' + instance.name + ':' + prop.name;
        visit(path, api.get(path));
      }
    }
    return values;
  };
  const step = (dt: number) => {
    if (breaks.size) {
      const probe = new Player(model, opts);
      const handles = new Map<string, TimelineInstance>();
      const trace = traceWrites(probe, (write) => {
        if (replaying) return;
        for (const [path, condition] of breaks) {
          if (
            dataPath(path) !== write.path ||
            ('value' in condition &&
              JSON.stringify(write.value) !== JSON.stringify(condition.value))
          )
            continue;
          diagnostics.push({
            code: 'script-breakpoint',
            pointer: `/script/${line - 1}`,
            message: `${path} would write ${JSON.stringify(write.value)} (before ${JSON.stringify(write.before)})`,
            hint: 'use data break clear, then advance to resume',
            writer: [write.writer],
          });
          stopped = true;
          throw new Breakpoint();
        }
      });
      try {
        // Replay establishes pending writes with their original script provenance. Only trap
        // the proposed step: historical writes have already been accepted by the live player.
        replaying = true;
        for (const { op, writer } of journal) trace.run(writer, () => op(probe, handles));
        const s = semantic,
          last = s ? writer : lastWriter;
        if (s) trace.run(last, () => replaySemantic(probe, s.cmd, s.args, s.steps));
        replaying = false;
        trace.run(last, () => probe.step(dt));
      } finally {
        replaying = false;
        trace.close();
      }
    }
    // Counts attempted live steps: a step that throws has still mutated the player.
    if (semantic) semantic.steps++;
    const r = opts.onEvents ? captureStep(() => p.step(dt)) : p.step(dt);
    if (!semantic)
      journal.push({
        op: (player) => {
          player.step(dt);
        },
        writer,
      });
    opts.onEvents?.(
      r.events.map((event) => {
        const e = event as CapturedEvent;
        return {
          ...e,
          time: p.time - dt + dt * (e[occurrence] ?? 0),
          [eventSource]: e[eventSource] ?? model,
        };
      }),
    );
    events.push(...r.events);
    settled = r.settled;
    for (const [path, previous] of watched) {
      const stamp = JSON.stringify(data().get(dataPath(path)));
      if (stamp !== previous) changedData.add(path);
      watched.set(path, stamp);
    }
  };
  const allValues = (player = p): Record<string, number | string | boolean | [number, number]> => {
    const source = player.model;
    const values = player.values();
    for (const node of source.nodes) {
      const keys = [
        ...Object.keys(COMMON),
        ...Object.keys(OWN[node.type]),
        ...Object.entries(PAINT).flatMap(([paint, fields]) =>
          Object.keys(fields).map((key) => paint + '.' + key),
        ),
      ];
      for (const key of keys) {
        const address = node.id + '.' + key;
        if (address in values) continue;
        const resolved = resolveAddress(address, source.nodes, source.ids);
        if (!Array.isArray(resolved)) {
          const v = resolved.rest;
          if (v !== undefined)
            values[address] = Array.isArray(v) && v.length === 4 ? formatHex(v) : v;
        }
      }
    }
    for (const [name, input] of source.inputs) {
      if (input.type === 'trigger') continue;
      const v = player.get(name);
      if (v !== undefined) values[name] = Array.isArray(v) && v.length === 4 ? formatHex(v) : v;
    }
    const children = (player.nested as { players?: Map<string, Player> } | undefined)?.players;
    for (const [id, child] of children ?? [])
      for (const [address, value] of Object.entries(allValues(child)))
        values[id + '/' + address] = value;
    const lists = modules.get('lists') as
      typeof import('../../../modules/lists/core/index.ts').lists | undefined;
    for (const run of lists?.listState(player)?.runs ?? []) {
      for (const item of run.items) {
        const prefix =
          source.nodes[run.spec.node]!.id.replaceAll('.', '/') + '/' + item.index + '/';
        for (const [address, value] of Object.entries(allValues(item.player)))
          values[prefix + address] = value;
      }
    }
    return values;
  };
  const canonicalAddress = (address: string): string => {
    const aliases = [
      ...[
        ...Object.entries(COMMON),
        ...Object.values(OWN).flatMap((props) => Object.entries(props)),
      ].map(([key, prop]) => [key, markupName(prop, key)]),
      ...Object.entries(PAINT).flatMap(([paint, props]) =>
        Object.entries(props).map(([key, prop]) => [paint + '.' + key, markupName(prop, key)]),
      ),
    ];
    return p.get(address) !== undefined || p.value(address) !== undefined
      ? address
      : (Object.keys(allValues()).find((key) =>
          aliases.some(
            ([path, alias]) =>
              key.endsWith('.' + path) && key.slice(0, -path!.length) + alias === address,
          ),
        ) ?? address);
  };
  const read = (address: string) => {
    address = canonicalAddress(address);
    if (address.startsWith('$')) {
      const value = p.get(address) ?? data().get(dataPath(address));
      return model.inputs.get(address)?.type === 'color' && Array.isArray(value)
        ? formatHex(value as [number, number, number, number])
        : value;
    }
    return p.get(address) ?? p.value(address) ?? allValues()[address];
  };
  const execute = (text: string) => {
    stopped = false;
    out.length = output.length = diagnostics.length = 0;
    const start = { snapshots: out.length, output: output.length, diagnostics: diagnostics.length };
    for (const raw of text.split('\n')) {
      line++;
      let words: string[];
      try {
        words = tokenize(raw, line);
      } catch (e) {
        // A pending `expect-error` also covers a line that does not tokenize.
        if (!expectedError) throw e;
        const code = (e as ScriptError).code ?? 'script-usage';
        if (code !== expectedError)
          diagnostics.push({
            code: 'script-expect-error',
            pointer: `/script/${line - 1}`,
            message: 'expected ' + expectedError + ', received ' + code,
            hint: 'check the expected diagnostic code',
          });
        expectedError = undefined;
        continue;
      }
      if (!words.length) continue;
      const [cmd, ...args] = words;
      const num = (s: string | undefined, what: string) => {
        const n = Number(s);
        if (s === undefined || !Number.isFinite(n))
          throw new ScriptError(`${what} must be a number`, line);
        return n;
      };
      const expected = cmd === 'expect-error' ? undefined : expectedError;
      if (cmd !== 'expect-error') expectedError = undefined;
      const diagnosticStart = diagnostics.length;
      try {
        writer = `script line ${line}: ${raw.trim()}`;
        const literal = (v: string | undefined) => {
          if (v === undefined) throw new ScriptError('missing value', line);
          try {
            return JSON.parse(v);
          } catch {
            return v;
          }
        };
        if (cmd === 'semantic' && args.length === 2) {
          const find = (
            nodes: import('../../../modules/a11y/core/types.ts').SemanticNode[],
          ): boolean => nodes.some((n) => n.id === args[0] || find(n.children));
          if (!find(p.semantics?.() ?? []))
            targetError(
              'hidden or absent semantic node "' +
                args[0] +
                '"; inspect semantics before targeting it',
            );
        }
        const s = (semantic = { cmd: cmd!, args, steps: 0 });
        let handled = false;
        try {
          handled =
            cmd !== 'snapshot' &&
            semanticCommand(p, cmd!, args, output, step, () => ({}) as Snapshot);
        } catch (e) {
          handled = true;
          throw e;
        } finally {
          semantic = undefined;
          if (handled) {
            // A failure or breakpoint keeps the accepted mutations, up to the step it stopped.
            const limit = s.steps;
            journal.push({ op: (player) => replaySemantic(player, s.cmd, s.args, limit), writer });
            lastWriter = writer;
          }
        }
        if (!handled)
          switch (cmd) {
            case 'group':
              if (args.length !== 1) throw new ScriptError('use group <name>', line);
              groups.push(args[0]!);
              break;
            case 'end':
              if (args.length || !groups.length)
                throw new ScriptError('end requires an open group', line);
              groups.pop();
              break;
            case 'expect-error':
              if (args.length !== 1 || expectedError)
                throw new ScriptError('use expect-error <code> before one command', line);
              expectedError = args[0];
              break;
            case 'seed': {
              if (
                args.length !== 1 ||
                !Number.isInteger(num(args[0], 'seed')) ||
                Number(args[0]) < 0 ||
                Number(args[0]) > 0xffffffff
              )
                throw new ScriptError('seed must be a uint32 integer', line);
              seed = Number(args[0]);
              const nextSeed = seed;
              act((player) => player.randomSource.reset(nextSeed));
              break;
            }
            case 'data': {
              const [op, path] = args;
              if (op === 'set' && args.length === 3 && path?.startsWith('$')) {
                const value = literal(args[2]);
                act((player) => {
                  writeData(player, path, value);
                });
                dataWritten = true;
              } else if (op === 'dump') {
                const prefixes = args.slice(1);
                const values = Object.fromEntries(
                  Object.entries(dataValues()).filter(
                    ([key]) =>
                      !prefixes.length || prefixes.some((prefix) => key.startsWith(prefix)),
                  ),
                );
                output.push({ data: values });
              } else if (op === 'watch' && args.length > 1) {
                for (const path of args.slice(1)) {
                  if (!path.startsWith('$')) throw new ScriptError('data watch needs $paths', line);
                  watched.set(path, JSON.stringify(data().get(dataPath(path))));
                }
              } else if (op === 'break' && path === 'clear' && args.length === 2) breaks.clear();
              else if (
                op === 'break' &&
                path?.startsWith('$') &&
                (args.length === 2 || (args.length === 4 && args[2] === '=='))
              ) {
                data().get(dataPath(path));
                breaks.set(path, args.length === 4 ? { value: literal(args[3]) } : {});
              } else
                throw new ScriptError(
                  'use data set <$path> <value> | dump [prefix…] | watch <$path…> | break <$path> [== value] | break clear',
                  line,
                );
              break;
            }
            case 'expect': {
              if (args.length !== 3 || !['==', '!=', '<', '>', '~'].includes(args[1]!))
                throw new ScriptError('use expect <address|$path|input> ==|!=|<|>|~ <value>', line);
              const actual = read(args[0]!);
              if (actual === undefined)
                throw new ScriptError(`unknown assertion address "${args[0]}"`, line);
              const expected = literal(args[2]),
                op = args[1];
              const same = JSON.stringify(actual) === JSON.stringify(expected);
              const pass =
                op === '=='
                  ? same
                  : op === '!='
                    ? !same
                    : typeof actual === 'number' &&
                      typeof expected === 'number' &&
                      (op === '<'
                        ? actual < expected
                        : op === '>'
                          ? actual > expected
                          : Math.abs(actual - expected) <= 1e-6);
              if (!pass)
                diagnostics.push({
                  code: 'script-expect',
                  pointer: `/script/${line - 1}`,
                  message: `${groups.length ? '[' + groups.join('/') + '] ' : ''}${args[0]} ${op} ${args[2]} failed (actual ${JSON.stringify(actual)})`,
                  hint: 'check the expected value or advance queued writes before asserting',
                });
              break;
            }
            case 'touch': {
              if (args.length !== 4 || !['down', 'move', 'up'].includes(args[0]!))
                throw new ScriptError('use touch down|move|up <id> <x> <y>', line);
              const id = num(args[1], 'pointer id'),
                x = num(args[2], 'x'),
                y = num(args[3], 'y');
              if (!Number.isInteger(id) || id < 0)
                throw new ScriptError('pointer id must be a nonnegative integer', line);
              act((player) => {
                player.input().pointer(args[0] as 'down' | 'move' | 'up', x, y, { id });
              });
              step(0);
              if (args[0] === 'up') {
                act((player) => {
                  player.input().pointer('leave', 0, 0, { id });
                });
                step(0);
              }
              break;
            }
            case 'advance': {
              const t = num(args[0], 'advance time');
              if (t < 0) throw new ScriptError('advance time must be ≥ 0', line);
              let n = 1;
              if (!args.length) throw new ScriptError('advance needs seconds', line);
              if (args.length > 1) {
                if (args[1] !== 'in' || args.length !== 3)
                  throw new ScriptError('use "advance <seconds> [in <n>]"', line);
                n = num(args[2], 'step count');
                if (!Number.isInteger(n) || n < 1)
                  throw new ScriptError('step count must be a whole number ≥ 1', line);
              }
              // A data write takes effect when written: a zero-length step lets converters start from
              // the write's time, so `data set …; advance 1` ends settled (#53).
              if (dataWritten && t > 0) step(0);
              dataWritten = false;
              for (let k = 0; k < n; k++) step(t / n);
              break;
            }
            case 'set': {
              if (args.length !== 2) throw new ScriptError('use "set <input> <value>"', line);
              requireInput(args[0]!);
              const type = model.inputs.get(args[0]!)?.type;
              const v =
                args[0]!.startsWith('$') && (type === 'string' || type === 'color')
                  ? args[1]!.startsWith('"')
                    ? JSON.parse(args[1]!)
                    : args[1]!
                  : args[1] === 'true'
                    ? true
                    : args[1] === 'false'
                      ? false
                      : num(args[1], 'value');
              act((player) => {
                player.set(args[0]!, v);
              });
              break;
            }
            case 'fire':
            case 'toggle':
              if (args.length !== 1) throw new ScriptError(`use "${cmd} <input>"`, line);
              requireInput(args[0]!);
              act((player) => {
                if (cmd === 'fire') player.fire(args[0]!);
                else player.toggle(args[0]!);
              });
              break;
            case 'pointer': {
              const kind = args[0];
              if (kind === 'drag') {
                if (args.length !== 5 && !(args.length === 7 && args[5] === 'in'))
                  throw new ScriptError('use pointer drag <x0> <y0> <x1> <y1> [in <n>]', line);
                const x0 = num(args[1], 'x0'),
                  y0 = num(args[2], 'y0'),
                  x1 = num(args[3], 'x1'),
                  y1 = num(args[4], 'y1');
                const n = args[6] === undefined ? 1 : num(args[6], 'step count');
                if (!Number.isInteger(n) || n < 1)
                  throw new ScriptError('step count must be a whole number ≥ 1', line);
                act((player) => {
                  player.pointer('move', x0, y0);
                });
                step(0);
                act((player) => {
                  player.pointer('down', x0, y0);
                });
                step(0);
                for (let i = 1; i <= n; i++) {
                  act((player) => {
                    player.pointer('move', x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n);
                  });
                  step(0);
                }
                act((player) => {
                  player.pointer('up', x1, y1);
                });
                step(0);
                break;
              }
              if (kind === 'leave' && args.length === 1) {
                act((player) => {
                  player.pointer('leave');
                });
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
                act((player) => {
                  player.pointer(k, x, y);
                });
                step(0);
              }
              break;
            }
            case 'focus': {
              act((player) => {
                if (args[0] === 'clear' && args.length === 1) player.focusClear();
                else if (args[0] === 'target' && args.length === 2) player.focusTarget(args[1]!);
                else if (args[0] === 'traverse' && args.length === 2)
                  player.focusTraverse(
                    args[1] as import('../../../modules/focus/core/index.ts').Direction,
                  );
                else
                  throw new ScriptError('use "focus clear|target <id>|traverse <direction>"', line);
              });
              step(0);
              break;
            }
            case 'key': {
              if (model.doc.requires?.includes('input')) {
                act((player) => {
                  inputCommand(player, 'key', args);
                });
                step(0);
                break;
              }
              if (
                !['down', 'up'].includes(args[0]!) ||
                args.length < 2 ||
                args.length > 3 ||
                (args.length === 3 && args[2] !== 'shift')
              )
                throw new ScriptError('use "key down|up <key> [shift]"', line);
              act((player) => {
                player.focusKey(args[1]!, args[0] === 'down', args[2] === 'shift');
              });
              step(0);
              break;
            }
            case 'instance': {
              if (args.length < 2 || args.length > 3)
                throw new ScriptError('use "instance <id> <timeline> [mix]"', line);
              act((player, handles) => {
                handles.set(
                  args[0]!,
                  player.createTimeline(args[1]!, {
                    name: args[0]!,
                    mix: args[2] === undefined ? 1 : num(args[2], 'mix'),
                  }),
                );
              });
              break;
            }
            case 'timeline': {
              const name = args[0]!,
                op = args[1];
              act((player, handles) => {
                const t = handles.get(name) ?? player.timeline(name);
                if (op === 'play' || op === 'pause' || op === 'stop') t[op]();
                else if (op === 'seek' || op === 'scrub') t[op](num(args[2], op));
                else if (op === 'speed' || op === 'mix') t[op] = num(args[2], op);
                else if (
                  op === 'loop' &&
                  ['once', 'loop', 'pingpong', 'authored'].includes(args[2]!)
                )
                  t.loop = args[2] === 'authored' ? null : (args[2] as TimelineInstance['loop']);
                else
                  throw new ScriptError(
                    'use "timeline <name> play|pause|stop|seek|scrub|speed|mix|loop [value]"',
                    line,
                  );
              });
              break;
            }
            case 'machine': {
              act((player) => {
                const m = player.machine(args[0]!),
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
              });
              break;
            }
            case 'motion':
              if (args[0] !== 'reduce' && args[0] !== 'full')
                throw new ScriptError('use "motion reduce|full"', line);
              act((player) => {
                player.reducedMotion = args[0] === 'reduce';
              });
              break;
            case 'snapshot': {
              const all = opts.all || args.includes('--all');
              const semantics = opts.semantics || args.includes('--semantics');
              const addresses = args.filter((arg) => arg !== '--all' && arg !== '--semantics');
              let values = all ? allValues() : p.values();
              if (addresses.length) {
                const pick: typeof values = {};
                // Prefer exact input/JSON addresses. Resolve AniML aliases from the same registry
                // as the compiler, including slash-scoped component snapshot addresses.
                for (const a of addresses) {
                  const canonical = canonicalAddress(a);
                  const v = read(canonical);
                  if (v === undefined)
                    throw new ScriptError(
                      `"${a}" is not an animated address or a bool/number input`,
                      line,
                    );
                  pick[canonical] =
                    Array.isArray(v) && v.length === 4
                      ? formatHex(v as [number, number, number, number])
                      : (v as number | boolean | string | [number, number]);
                }
                values = pick;
              }
              const snapshot: Snapshot = {
                time: p.time,
                values,
                states: p.states(),
                events,
                settled,
              };
              if (watched.size) {
                snapshot.data = {};
                for (const path of changedData) snapshot.data[path] = data().get(dataPath(path));
                changedData.clear();
              }
              if (semantics) {
                const semanticPlayer = p as Player & { semantics?: () => unknown };
                if (!semanticPlayer.semantics)
                  throw new ScriptError('semantics module is not loaded', line);
                snapshot.semantics = semanticPlayer.semantics();
              }
              out.push(snapshot);
              output.push(snapshot);
              events = [];
              break;
            }
            default:
              if (
                ['contact', 'scroll', 'gamepads', 'pointer-enable', 'scroll-cancel'].includes(cmd!)
              ) {
                act((player) => {
                  inputCommand(player, cmd!, args);
                });
                step(0);
                break;
              }
              throw new ScriptError(`unknown command "${cmd}"`, line);
          }
        if (expected) {
          const emitted = diagnostics.splice(diagnosticStart);
          if (!emitted.some((d) => d.code === expected))
            diagnostics.push({
              code: 'script-expect-error',
              pointer: `/script/${line - 1}`,
              message: 'expected error ' + expected + ' in ' + groups.join('/'),
              hint: 'follow expect-error with a command producing that code',
            });
        }
      } catch (e) {
        const error = e as Error & { code?: string; hint?: string };
        if (expected) {
          if ((error.code ?? 'script-usage') !== expected)
            diagnostics.push({
              code: 'script-expect-error',
              pointer: `/script/${line - 1}`,
              message: 'expected ' + expected + ', received ' + (error.code ?? 'script-usage'),
              hint: 'check the expected diagnostic code',
            });
          continue;
        }
        if (e instanceof Breakpoint) break;
        if (e instanceof ScriptError) throw e;
        // seam(P6-9b): preserve structured layout/font diagnostics through script sampling.
        const failure = new ScriptError(error.message.replace(/^anima: /, ''), line, error.code);
        if (error.hint) Object.assign(failure, { hint: error.hint });
        throw failure;
      }
    }
    return {
      snapshots: out.slice(start.snapshots),
      output: output.slice(start.output),
      diagnostics: diagnostics.slice(start.diagnostics),
      stopped,
    };
  };
  if (opts.seed !== undefined) {
    execute('seed ' + opts.seed);
    line = 0;
  }
  return {
    player: p,
    execute,
    dataValues,
    finish() {
      if (groups.length) throw new ScriptError('unclosed group ' + groups.join('/'), line);
      if (expectedError)
        throw new ScriptError(
          'expect-error needs a following command',
          line,
          'script-expect-error',
        );
    },
    get seed() {
      return seed;
    },
  };
}

/** Run a script against a fresh player; assertion failures accumulate without aborting. */
export function runScript(model: Model, text: string, opts: ScriptOptions = {}) {
  const session = createScriptSession(model, opts);
  const result = session.execute(text);
  session.finish();
  return { ...result, player: session.player };
}

/** JSON strings/arrays/objects stay together; #hex is a value, # otherwise begins a comment. */
function tokenize(raw: string, line: number): string[] {
  const words: string[] = [];
  let token = '',
    quoted = false,
    escaped = false,
    depth = 0;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]!;
    if (
      !quoted &&
      depth === 0 &&
      !token &&
      c === '#' &&
      !(
        ((words[0] === 'set' && words.length === 2) ||
          (words[0] === 'data' && words[1] === 'set' && words.length === 3) ||
          (words[0] === 'data' && words[1] === 'break' && words.length === 4) ||
          (words[0] === 'expect' && words.length === 3)) &&
        /^#[a-f\d]{3,8}(?=\s|$)/i.test(raw.slice(i))
      )
    )
      break;
    if (!quoted && depth === 0 && /\s/.test(c)) {
      if (token) words.push(token);
      token = '';
      continue;
    }
    token += c;
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
  }
  if (quoted || depth !== 0) throw new ScriptError('unterminated JSON value', line);
  if (token) words.push(token);
  return words;
}
