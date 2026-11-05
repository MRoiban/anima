// Optional build-time library/template layer, including async URL resolution.
import '@anima-format/markup/libraries';
import { libraryCompiler } from '@anima-format/markup/library-hooks';
import { registerLibraries } from '../../../packages/web/src/markup.ts';
registerLibraries(libraryCompiler);
export { compileAsync } from '../../../packages/web/src/markup.ts';
