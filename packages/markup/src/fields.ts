// Non-node element attributes derive from the live document registry, including late modules.
import { DOC, markupName, type ObjShape, type Shape } from '@anima-format/core';
export function elementFields(name: string): { key: string; attr: string; shape: Shape }[] {
  const doc = DOC as ObjShape;
  const layer = ((doc.p.machine as ObjShape).p.layers as Extract<Shape, { k: 'map' }>)
    .of as ObjShape;
  const state = (layer.p.states as Extract<Shape, { k: 'map' }>).of as ObjShape;
  const shape =
    name === 'state'
      ? state
      : name === 'on'
        ? ((state.p.on as Extract<Shape, { k: 'arr' }>).of as ObjShape)
        : name === 'layer'
          ? layer
          : name === 'timeline'
            ? ((doc.p.timelines as Extract<Shape, { k: 'map' }>).of as ObjShape)
            : name === 'listener'
              ? ((doc.p.listeners as Extract<Shape, { k: 'arr' }>).of as ObjShape)
              : name === 'anima'
                ? doc
                : undefined;
  return Object.entries(shape?.p ?? {})
    .filter(([key, s]) =>
      name === 'anima'
        ? !!s.feature && (['num', 'bool', 'str'].includes(s.k) || (!!s.markup && !s.element))
        : !(
            { state: ['pose', 'on'], layer: ['states'], timeline: ['tracks', 'events'] } as Record<
              string,
              string[]
            >
          )[name]?.includes(key),
    )
    .map(([key, shape]) => ({ key, attr: markupName(shape, key), shape }));
}
export const compoundField = (s: Shape): boolean =>
  ['obj', 'map', 'any', 'arr', 'alt'].includes(s.k);
