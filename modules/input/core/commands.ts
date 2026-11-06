// Tooling-only command dispatcher. The shared sample switch can delegate its default here.
import type { Player } from '../../../packages/core/src/player.ts';
import type { GamepadRecord, KeyOptions, ScrollOptions } from './types.ts';
const number = (text: string | undefined): number => {
  if (text === undefined || text.trim() === '' || !Number.isFinite(Number(text)))
    throw Error('expected a finite number');
  return Number(text);
};
/** Returns false for commands owned by the base language; true commands need a subsequent step(0). */
export function inputCommand(player: Player, command: string, args: string[]): boolean {
  if (
    !['contact', 'key', 'scroll', 'gamepads', 'pointer-enable', 'scroll-cancel'].includes(command)
  )
    return false;
  const c = player.input();
  if (command === 'contact') {
    if (
      !['move', 'down', 'up', 'leave', 'cancel'].includes(args[0]!) ||
      ![2, 4, 5].includes(args.length)
    )
      throw Error('use contact <move|down|up|leave|cancel> <id> [x y [button]]');
    const kind = args[0] as Parameters<typeof c.pointer>[0];
    if (kind === 'leave' || kind === 'cancel' ? args.length !== 2 : args.length < 4)
      throw Error('contact leave/cancel takes only an id; other phases need x y');
    c.pointer(kind, args.length > 2 ? number(args[2]) : 0, args.length > 2 ? number(args[3]) : 0, {
      id: number(args[1]),
      button: args[4] === undefined ? 0 : number(args[4]),
    });
  } else if (command === 'key') {
    if (!['down', 'up', 'repeat'].includes(args[0]!) || args.length < 2 || args.length > 4)
      throw Error('use key <down|up|repeat> <key|Space> [shift+control+alt+meta|-] [target]');
    const opts: KeyOptions = { repeat: args[0] === 'repeat', target: args[3] };
    const mods = args[2] && args[2] !== '-' ? args[2].split('+') : [];
    if (
      mods.some((m) => !['shift', 'control', 'alt', 'meta'].includes(m)) ||
      new Set(mods).size !== mods.length
    )
      throw Error('unknown or duplicate key modifier');
    for (const key of mods) opts[key as 'shift' | 'control' | 'alt' | 'meta'] = true;
    c.key(args[0] === 'up' ? 'up' : 'down', args[1] === 'Space' ? ' ' : args[1]!, opts);
  } else if (command === 'scroll') {
    if (args.length < 4 || args.length > 6)
      throw Error('use scroll <x> <y> <dx> <dy> [start|move|end|cancel] [seconds]');
    const phase = args[4] as ScrollOptions['phase'];
    if (phase && !['start', 'move', 'end', 'cancel'].includes(phase))
      throw Error('unknown scroll phase');
    c.scroll(number(args[0]), number(args[1]), number(args[2]), number(args[3]), {
      phase,
      time: args[5] === undefined ? undefined : number(args[5]),
    });
  } else if (command === 'gamepads') {
    const batch: GamepadRecord[] = JSON.parse(args.join(' '));
    if (!Array.isArray(batch)) throw Error('gamepads expects a JSON array');
    c.gamepads(batch);
  } else if (command === 'pointer-enable') {
    if (args.length !== 2 || !['true', 'false'].includes(args[1]!))
      throw Error('use pointer-enable <id> <true|false>');
    c.enablePointer(number(args[0]), args[1] === 'true');
  } else {
    if (args.length) throw Error('scroll-cancel takes no arguments');
    c.cancelScroll();
  }
  return true;
}
