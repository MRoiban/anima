import type { Diagnostic } from '@anima-format/core';
import { Font as OpenType } from '../../../../modules/fonts/core/opentype/reader.ts';
import { Bytes, diagnostic, fault } from './binary.ts';
import { unpack } from './container.ts';
export { contoursPath } from '../../../../modules/fonts/core/opentype/reader.ts';
export type {
  Axis,
  Instance,
  Point,
  Contour,
  GlyphAdjustment,
  PairAdjustment,
} from '../../../../modules/fonts/core/opentype/reader.ts';
export class Font extends OpenType<Buffer> {
  constructor(bytes: Uint8Array) {
    super(unpack(bytes));
  }
  override table(tag: string): Bytes {
    const b = this.tables.get(tag);
    if (!b) fault('missing font table ' + tag);
    return new Bytes(b);
  }
}
export function readFont(
  bytes: Uint8Array,
  pointer = '',
): { font?: Font; diagnostics: Diagnostic[] } {
  try {
    return { font: new Font(bytes), diagnostics: [] };
  } catch (error) {
    return { diagnostics: [diagnostic(error, pointer)] };
  }
}
