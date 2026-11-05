// Tooling registers this layer through the default entry; browsers opt in explicitly.
import { libraryCompiler } from './library-hooks.ts';
import { expand } from './reuse.ts';
import { compileLibrariesAsync } from './libraries-async.ts';

libraryCompiler.expand = expand;
libraryCompiler.async = compileLibrariesAsync;
export { importPath } from './reuse.ts';
