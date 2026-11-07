import type { ModuleEntry } from '../../../packages/core/src/modules.ts';
import { FILL, STROKE, type Shape, type ObjShape } from '../../../packages/core/src/registry.ts';
const n = (min?: number): Shape => ({ k: 'num', min });
const s = (of?: string[], markup?: string): Shape => ({ k: 'str', of, markup });
export const styleShape: ObjShape = {
  k: 'obj',
  p: {
    font: s(),
    size: { k: 'num', gt: 0 },
    weight: { k: 'num', min: 1, max: 1000 },
    style: s(['normal', 'italic']),
    tracking: n(),
    lineHeight: { ...n(0), markup: 'line-height' },
    fill: FILL,
    stroke: STROKE,
  },
};
export const runShape: ObjShape = {
  k: 'obj',
  req: ['text'],
  p: { id: s(), text: s(), style: s() },
};
export const textShapes: Record<string, Shape> = {
  runs: { k: 'alt', of: [{ k: 'arr', of: runShape }, s()] },
  styles: { k: 'map', of: styleShape },
  width: n(0),
  height: n(0),
  sizing: s(['fixed', 'auto-width', 'auto-height']),
  align: s(['left', 'center', 'right', 'start', 'end']),
  valign: s(['top', 'middle', 'bottom']),
  overflow: s(['visible', 'hidden', 'clipped', 'ellipsis', 'fit', 'fit-font-size']),
  wrap: { k: 'bool' },
  wordBreak: s(['normal', 'break-word', 'break-all'], 'word-break'),
  origin: { k: 'alt', of: [s(['top-left', 'baseline']), { k: 'tup', of: [n(), n()], min: 2 }] },
  lineHeight: { ...n(0), markup: 'line-height' },
  paragraphSpacing: { ...n(0), markup: 'paragraph-spacing' },
  verticalTrimTop: s(['none', 'cap', 'x-height'], 'vertical-trim-top'),
  verticalTrimBottom: s(['none', 'baseline'], 'vertical-trim-bottom'),
  fitFromBaseline: { k: 'bool', markup: 'fit-from-baseline' },
  fitFontSizeResizesBox: { k: 'bool', markup: 'fit-font-size-resizes-box' },
  textField: { ...s(), markup: 'text-field' },
  styleField: { ...s(), markup: 'style-field' },
};
export const entries: ModuleEntry[] = [
  {
    target: 'text',
    node: { painted: true },
    shapes: textShapes,
    props: Object.fromEntries(
      ['width', 'height', 'lineHeight', 'paragraphSpacing'].map((key) => [
        key,
        { type: 'number' as const, min: 0, markup: textShapes[key]!.markup },
      ]),
    ),
    required: ['id', 'type', 'runs'],
    elements: {
      run: {
        shape: runShape,
        target: { attribute: 'target', default: 'runs', choices: ['runs'], array: true },
      },
      style: {
        shape: { ...styleShape, p: { id: s(), ...styleShape.p }, req: ['id'] },
        target: { attribute: 'target', default: 'styles', choices: ['styles'], mapKey: 'id' },
      },
      'text-style': {
        shape: { ...styleShape, p: { id: s(), ...styleShape.p }, req: ['id'] },
        root: 'textStyles',
        mapKey: 'id',
      },
    },
  },
  {
    target: 'document',
    shapes: { textStyles: { k: 'map', of: styleShape, markup: 'text-styles' } },
  },
];
