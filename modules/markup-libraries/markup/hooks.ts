// The base compiler has no dependency on library expansion or import resolution.
import type {
  CompileOptions,
  CompileResult,
  MarkupDiagnostic,
} from '../../../packages/markup/src/index.ts';
import type { XmlDocument, Pos } from '../../../packages/markup/src/xml.ts';

export type AsyncCompileOptions = Omit<CompileOptions, 'resolve'> & {
  resolve: (path: string) => string | Promise<string>;
};
export const libraryCompiler: {
  expand?: (xml: XmlDocument, opts: CompileOptions, diagnostics: MarkupDiagnostic[]) => void;
  // seam(P6-4a): use the caller's prepared compiler across separately emitted bundles.
  async?: (
    source: string,
    opts: AsyncCompileOptions,
    compiler?: (source: string, opts?: CompileOptions) => CompileResult,
  ) => Promise<CompileResult>;
} = {};
export function location(at: Pos): { file?: string; line: number; column: number } {
  return { file: at.file, line: at.line, column: at.col };
}
