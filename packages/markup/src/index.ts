// AniML (spec/ANIML.md): the authoring format. `compile` turns markup into `.ani` (the runtime and
// conformance format) with a source map, so every diagnostic names a line and column in the markup.

import type { Diagnostic } from '@anima-format/core';
import type { Pos } from './xml.ts';

export {
  parseXml,
  escapeAttr,
  escapeText,
  type Attr,
  type Child,
  type Comment,
  type Element,
  type Pos,
  type Text,
  type XmlDocument,
  type XmlError,
} from './xml.ts';

/** A diagnostic against the markup: the `.ani` fields plus where in the `.animl` file it is. */
export interface MarkupDiagnostic extends Diagnostic {
  /** 1-based position in the markup; absent only when nothing in the markup can be blamed. */
  line?: number;
  column?: number;
  /** The file name given to `compile`, if any. */
  file?: string;
}

export interface CompileOptions {
  /** File name to put on diagnostics. */
  file?: string;
  /** Run the strict `.ani` loader on the result and map its diagnostics (default true). */
  validate?: boolean;
}

export interface CompileResult {
  /** The compiled `.ani` document (keys in canonical order); absent when there are errors. */
  doc?: Record<string, unknown>;
  /** The compiled document as canonical `.ani` text (`formatAni`); absent when there are errors. */
  text?: string;
  /** Markup errors (spec/ANIML.md §7) and the loader's diagnostics, mapped to markup positions. */
  diagnostics: MarkupDiagnostic[];
  /** Source map: compiled JSON pointer → the markup position that produced it. */
  map: Map<string, Pos>;
}

/** Compile AniML to `.ani` (spec/ANIML.md §7). Never throws on bad input. */
export { compile } from './compile.ts';

/** Canonical AniML for a compiled document (spec/ANIML.md §8). `doc` may be text or parsed. */
export { decompile } from './decompile.ts';

/** Reformat AniML in the canonical layout, keeping comments, element order and named eases. */
export { formatMarkup } from './format.ts';
