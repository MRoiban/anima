/** Shared core/host/overlay contract. Coordinates are world grid units. */
export type SemanticAction = 'tap' | 'increase' | 'decrease' | 'focus';
export interface SemanticNode {
  id: string;
  role: string;
  label?: string;
  hint?: string;
  value?: string | number;
  valueText?: string;
  level?: number;
  href?: string;
  controls?: string;
  states: {
    checked?: boolean | 'mixed';
    pressed?: boolean;
    selected?: boolean;
    expanded?: boolean;
    disabled?: boolean;
    required?: boolean;
    readonly?: boolean;
    modal?: boolean;
    focused?: boolean;
    live?: 'polite' | 'assertive';
  };
  min?: number;
  max?: number;
  step?: number;
  bounds: [number, number, number, number];
  actions: SemanticAction[];
  children: SemanticNode[];
}
export interface SemanticDiff {
  added: string[];
  removed: string[];
  changed: { id: string; keys: string[] }[];
}
export interface A11yConfig {
  role: string;
  label?: string;
  hint?: string;
  value?: string;
  valueText?: string;
  level?: number | string;
  href?: string;
  controls?: string;
  checked?: boolean | string;
  checkedMixed?: boolean | string;
  pressed?: boolean | string;
  selected?: boolean | string;
  expanded?: boolean | string;
  disabled?: boolean | string;
  hidden?: boolean | string;
  required?: boolean | string;
  readonly?: boolean | string;
  modal?: boolean | string;
  live?: 'off' | 'polite' | 'assertive';
  activate?: string;
  min?: number;
  max?: number;
  step?: number;
  bounds?: [number, number, number, number];
}
declare module '../../../packages/core/src/player.ts' {
  interface Player {
    semantics(): SemanticNode[];
    semanticDiff(previous: SemanticNode[], next: SemanticNode[]): SemanticDiff;
    semanticAction(id: string, action: SemanticAction): boolean;
  }
}
