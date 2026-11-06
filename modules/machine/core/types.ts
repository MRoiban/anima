import type {
  ActionM,
  LayerM,
  StateM,
  TransitionM,
  Value,
} from '../../../packages/core/src/load.ts';
import type { Player } from '../../../packages/core/src/player.ts';
export interface Actions {
  fire?: string | string[];
  set?: Record<string, number | boolean | string>;
  toggle?: string | string[];
  emit?: string;
}
export const compiledActions = new WeakMap<Actions, ActionM>();
export type Source = number | string | { bind: string };
export type Operand =
  | number
  | boolean
  | { artboard?: 'width' | 'height' | 'aspect'; component?: string; focus?: string };
export interface TransitionOptions {
  disabled?: boolean;
  weight?: number;
  continue?: boolean;
  exitRatio?: number;
  blendRatio?: number;
  actions?: Actions;
  endActions?: Actions;
  change?: { input: string; mode: 'changed' | 'increased' | 'decreased' };
  guard?: { left: Operand; right: Operand; op: '==' | '!=' | '<' | '<=' | '>' | '>=' };
}
export interface StateOptions {
  kind?: 'entry' | 'exit' | 'any' | 'random';
  reset?: boolean;
  enterActions?: Actions;
  exitActions?: Actions;
  mix?: {
    mode: '1d' | 'direct' | 'additive';
    axis?: Source;
    exit?: number;
    children: { play: string; at?: number; weight?: Source }[];
  };
}
export interface Run {
  m: LayerM;
  state: number;
  time: number;
  frozen: number;
  w: Map<number, (time: number) => Value>[];
  fade: null | { from: Map<number, Value>; t: number; dur: number };
}
export interface StateInfo extends StateOptions {
  children?: { timeline: number; at: number; weight: (p: Player) => number }[];
  axis?: (p: Player) => number;
}
export const states = new WeakMap<StateM, StateInfo>();
export const transitions = new WeakMap<TransitionM, TransitionOptions>();
declare module '../../../packages/core/src/player.ts' {
  interface Player {
    /** Focus module supplies this live reader and wakes onChange after focus changes. */
    machineFocus?: (target: string) => boolean;
  }
}
