// Optional AniML support (spec/ANIML.md §9). Import for its registration side effect.
import { structuralMarkup } from '@anima-format/markup/modules';
import { moduleCompiler } from '@anima-format/markup/module-hooks';
import { registerModule } from '@anima-format/core';
import { compile } from '@anima-format/markup';
import './index.ts';
import type { AnimaIcon } from './index.ts';

// Also work when the base browser bundle was already loaded as a separate module.
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.compiler = (source) => {
  Object.assign(moduleCompiler, structuralMarkup);
  for (const m of Icon.modules.values()) registerModule(m);
  return compile(source);
};
