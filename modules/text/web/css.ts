import type { FontSpec } from '../core/measure.ts';
export const cssFont = (f: FontSpec) => `${f.style} ${f.weight} ${f.size}px ${f.family}`;
