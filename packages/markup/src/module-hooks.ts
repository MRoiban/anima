import type { structuralMarkup } from './modules.ts';
export const moduleCompiler: Partial<typeof structuralMarkup> = {};

import type { componentMarkup } from './components.ts';
export const componentCompiler: Partial<typeof componentMarkup> = {};

import type { bindMarkup } from './bind.ts';
export const bindCompiler: Partial<typeof bindMarkup> = {};
