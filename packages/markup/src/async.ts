import { compile } from './compile.ts';
import { libraryCompiler, type AsyncCompileOptions } from './library-hooks.ts';
import type { CompileResult } from './index.ts';

/** Async hosts use the registered resolver layer, if present. */
export async function compileAsync(
  source: string,
  opts: AsyncCompileOptions,
): Promise<CompileResult> {
  return libraryCompiler.async
    ? libraryCompiler.async(source, opts, compile)
    : compile(source, { file: opts.file, validate: opts.validate });
}
