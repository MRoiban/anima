import type { ListenerM } from '../../../packages/core/src/load.ts';
export const events = [
  'enter',
  'leave',
  'move',
  'down',
  'up',
  'click',
  'cancel',
  'drag-start',
  'drag',
  'drag-end',
  'key-down',
  'key-repeat',
  'key-up',
  'scroll',
  'gamepad-axis',
  'gamepad-button',
  'gamepad-connected',
  'gamepad-disconnected',
] as const;
export type InputEvent = (typeof events)[number];
export type PointerEventKind = 'move' | 'down' | 'up' | 'leave' | 'cancel';
export interface PointerOptions {
  id?: number;
  button?: number;
}
export interface KeyOptions {
  repeat?: boolean;
  shift?: boolean;
  control?: boolean;
  alt?: boolean;
  meta?: boolean;
  target?: string;
}
export interface ScrollOptions {
  phase?: 'start' | 'move' | 'end' | 'cancel';
  time?: number;
}
export interface GamepadRecord {
  index: number;
  connected: boolean;
  mapping?: string;
  axes?: number[];
  buttons?: { value: number; pressed: boolean }[];
}
export interface InputListener {
  action: ListenerM;
  on: string[];
  target: number;
  order: number;
  depth: number;
  button?: number;
  capture?: boolean;
  consume?: boolean;
  key?: string;
  modifiers?: string;
  index?: number;
  control?: number;
  mapping?: 'standard' | 'raw';
  phase?: 'press' | 'release' | 'both';
  write?: Record<string, string>;
  align?: 'preserve' | 'snap';
}
export const cursors = [
  'arrow',
  'hidden',
  'pointer',
  'resize-horizontal',
  'resize-vertical',
  'text',
] as const;
export type Cursor = (typeof cursors)[number];
export const fields = [
  'x',
  'y',
  'dx',
  'dy',
  'startX',
  'startY',
  'pointerId',
  'button',
  'value',
  'pressed',
  'index',
  'control',
  'deltaX',
  'deltaY',
] as const;
export type Data = Partial<Record<(typeof fields)[number], number | boolean>>;
