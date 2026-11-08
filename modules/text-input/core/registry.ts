import type { ModuleEntry } from '../../../packages/core/src/modules.ts';
import type { Shape } from '../../../packages/core/src/registry.ts';
const bool: Shape = { k: 'bool' };
const str: Shape = { k: 'str' };
const color: Shape = {
  k: 'str',
  re: /^(?:#[\da-fA-F]{3}(?:[\da-fA-F]{3})?|#[\da-fA-F]{4}(?:[\da-fA-F]{4})?|currentColor)$/,
};
export const entries: ModuleEntry[] = [
  {
    target: 'text',
    shapes: {
      textInput: {
        k: 'obj',
        element: 'text-input',
        p: {
          editable: bool,
          multiline: bool,
          obscured: bool,
          placeholder: str,
          placeholderColor: { ...color, markup: 'placeholder-color' },
          selectOnFocus: { ...bool, markup: 'select-on-focus' },
          maxLength: { k: 'num', int: true, min: 0, markup: 'max-length' },
          maxLines: { k: 'num', int: true, min: 1, markup: 'max-lines' },
          writeText: { ...str, markup: 'write-text' },
          label: str,
          caretColor: { ...color, markup: 'caret-color' },
          selectionColor: { ...color, markup: 'selection-color' },
          selectedTextColor: { ...color, markup: 'selected-text-color' },
          selectedTextStyle: { ...str, markup: 'selected-text-style' },
          selectionRadius: { k: 'num', min: 0, markup: 'selection-radius' },
        },
      },
    },
  },
];

entries[0]!.elements = {
  'text-input': {
    shape: entries[0]!.shapes
      .textInput as import('../../../packages/core/src/registry.ts').ObjShape,
    target: { attribute: 'target', default: 'textInput', choices: ['textInput'] },
  },
};
