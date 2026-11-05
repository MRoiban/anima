// The base compiler has no dependency on library expansion or import resolution.
import type { CompileOptions, CompileResult, MarkupDiagnostic } from './index.ts';
import type { XmlDocument, Pos } from './xml.ts';

export type AsyncCompileOptions = Omit<CompileOptions, 'resolve'> & {
  resolve: (path: string) => string | Promise<string>;
};
export const libraryCompiler: {
  expand?: (xml: XmlDocument, opts: CompileOptions, diagnostics: MarkupDiagnostic[]) => void;
  async?: (source: string, opts: AsyncCompileOptions) => Promise<CompileResult>;
} = {};
export function location(at: Pos): { file?: string; line: number; column: number } {
  return { file: at.file, line: at.line, column: at.col };
}
