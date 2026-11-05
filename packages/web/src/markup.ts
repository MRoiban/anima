// Optional AniML support (spec/ANIML.md §9). Import for its registration side effect.
import { libraryCompiler } from '@anima-format/markup/library-hooks';
import { moduleCompiler, componentCompiler, bindCompiler } from '@anima-format/markup/module-hooks';
import { structuralForms } from '@anima-format/markup/modules';
import { registerModule, DOC, FILL, STROKE } from '@anima-format/core';
import { compile, compileAsync as compileAsyncBrowser } from '@anima-format/markup/browser';
import './index.ts';
import type { AnimaIcon } from './index.ts';

// Also work when the base browser bundle was already loaded as a separate module.
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
export function registerLibraries(hooks: typeof libraryCompiler): void {
  Icon.registerMarkup('libraries', hooks);
}
function prepare(): void {
  Object.assign(libraryCompiler, Icon.markupHooks.libraries);
  Object.assign(componentCompiler, Icon.markupHooks.components);
  Object.assign(bindCompiler, Icon.markupHooks.bind);
  Object.assign(moduleCompiler, structuralForms, Icon.markupHooks.paint);
  for (const m of Icon.modules.values()) registerModule(m);
  // Module init can refine existing shapes (image paint types, scoped component listeners).
  // Keep local containers so later registrations cannot write into the runtime's registry.
  const registry = { DOC, FILL, STROKE };
  for (const [key, shape] of Object.entries(Icon.registry))
    Object.assign(registry[key as keyof typeof registry], shape, { p: { ...shape.p } });
}
export const compileAsync: typeof compileAsyncBrowser = (source, opts) => {
  prepare();
  return compileAsyncBrowser(source, opts);
};
Icon.compiler = (source) => {
  prepare();
  return compile(source);
};

Icon.compilerAsync = (source, file) => {
  return compileAsync(source, {
    file,
    resolve: async (path) => {
      const response = await fetch(path);
      if (!response.ok) throw Error(`cannot fetch ${path}`);
      return response.text();
    },
  });
};

Icon.refresh();
