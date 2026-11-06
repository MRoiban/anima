import type { Shape, ObjShape } from '../../../packages/core/src/registry.ts';
import { cursors, events, fields } from './types.ts';
const num = (min?: number): Shape => ({ k: 'num', ...(min === undefined ? {} : { min }) });
const str = (en?: readonly string[]): Shape => ({ k: 'str', ...(en ? { of: [...en] } : {}) });
export const listenerFields: Record<string, Shape> = {
  button: num(0),
  capture: { k: 'bool' },
  consume: { k: 'bool' },
  propagate: { k: 'bool' },
  key: str(),
  modifiers: str(),
  index: num(0),
  control: num(0),
  mapping: str(['standard', 'raw']),
  phase: str(['press', 'release', 'both']),
  write: {
    k: 'map',
    of: str(),
    key: /^[a-z][a-zA-Z0-9-]*$/,
    description: `Map event field → declared input name (not an expression). Available event fields: ${fields.map((f) => f + (f === 'pressed' ? ' (bool)' : ' (number)')).join(', ')}. Missing fields leave inputs unchanged. x/y use target parent coordinates; align="preserve" retains the grab offset. Example: write='{"x":"dragX"}'.`,
  },
  align: str(['preserve', 'snap']),
};
export function extendListener(listener: ObjShape): ObjShape {
  const old = listener.p.on! as Extract<Shape, { k: 'str' }>;
  const pattern = `^(?:${events.join('|')})(?:\\|(?:${events.join('|')}))*$`;
  return {
    ...listener,
    p: {
      ...listener.p,
      on: {
        k: 'str',
        re: new RegExp(
          `(?:${old.re?.source ?? '^(?:enter|leave|down|up|click|move)$'})|(?:${pattern})`,
        ),
      },
      ...Object.fromEntries(
        Object.entries(listenerFields).map(([k, v]) => [k, { ...v, feature: 'input' }]),
      ),
    },
  };
}
export const nodeShapes: Record<string, Shape> = {
  pointerEnabled: { k: 'bool' },
  opaque: { k: 'bool' },
  cursor: str(cursors),
  collapsed: { k: 'bool' },
};
export const soloShape: Shape = num(-1);
