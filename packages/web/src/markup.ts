// Optional AniML support (spec/ANIML.md §9). Import for its registration side effect.
import { libraryCompiler } from '@anima-format/markup/library-hooks';
import { moduleCompiler, componentCompiler, bindCompiler } from '@anima-format/markup/module-hooks';
import { structuralForms } from '@anima-format/markup/modules';
import { registerModule } from '@anima-format/core';
import { compile, compileAsync as compileAsyncBrowser } from '@anima-format/markup/browser';
import './index.ts';
import type { AnimaIcon } from './index.ts';

// Also work when the base browser bundle was already loaded as a separate module.
const Icon = customElements.get('anima-icon') as typeof AnimaIcon & {
  markupLibraries?: typeof libraryCompiler;
  markupComponents?: typeof componentCompiler;
  markupBind?: typeof bindCompiler;
  markupStructure?: typeof moduleCompiler;
};
export function registerLibraries(hooks: typeof libraryCompiler): void {
  Icon.markupLibraries = hooks;
}
function prepare(): void {
  Object.assign(libraryCompiler, Icon.markupLibraries);
  Object.assign(componentCompiler, Icon.markupComponents);
  Object.assign(bindCompiler, Icon.markupBind);
  Object.assign(moduleCompiler, structuralForms, Icon.markupStructure);
  for (const m of Icon.modules.values()) registerModule(m);
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
