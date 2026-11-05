// Tooling registers this layer through the default entry; browsers opt in explicitly.
import { libraryCompiler } from './hooks.ts';
import { expand } from './reuse.ts';
import { compileLibrariesAsync } from './async.ts';

libraryCompiler.expand = expand;
libraryCompiler.async = compileLibrariesAsync;
export { importPath } from './reuse.ts';
