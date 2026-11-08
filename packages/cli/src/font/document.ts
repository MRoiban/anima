import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Diagnostic } from '@anima-format/core';
import { diagnostic, fault } from './binary.ts';
import { Font } from './reader.ts';
import { ToolMeasurer, shapingDiagnostic } from './measure.ts';
import { subsetFont } from './subset.ts';
import { featureTags } from './features.ts';

export interface FontAsset {
  type: string;
  source: string;
  family?: string;
  weight?: number;
  style?: 'normal' | 'italic';
  glyphs?: 'used' | 'all' | 'custom';
  chars?: string;
  mime?: string;
  size?: number;
  storage?: string;
  export?: boolean;
}
export interface FontDocument {
  assets?: Record<string, FontAsset>;
  components?: Record<string, FontDocument>;
}
const escape = (s: string) => s.replaceAll('~', '~0').replaceAll('/', '~1');
export function fontBytes(source: string, file: string): Buffer {
  const url = new URL(source, pathToFileURL(resolve(file)));
  if (url.protocol === 'data:') {
    const match = /^data:[^,]*;base64,([A-Za-z0-9+/]*={0,2})$/.exec(source);
    if (!match) fault('font data URI must use base64', 'font-format');
    return Buffer.from(match[1]!, 'base64');
  }
  if (url.protocol !== 'file:')
    fault('tool fonts must be local; import remote fonts at build time', 'font-source');
  return readFileSync(url);
}
export function documentCharacters(doc: unknown): string {
  // Includes authored literal runs and bound model defaults, not identifiers/source URLs.
  const chars: string[] = [];
  const visit = (value: unknown, key = '') => {
    if (typeof value === 'string' && ['text', 'default', 'value', 'placeholder'].includes(key))
      chars.push(value);
    else if (Array.isArray(value)) value.forEach((v) => visit(v, key));
    else if (value && typeof value === 'object') {
      if ('overflow' in value && value.overflow === 'ellipsis') chars.push('…');
      for (const [k, v] of Object.entries(value)) visit(v, k);
    }
  };
  visit(doc);
  return chars.join('');
}
export function documentFonts(
  doc: FontDocument,
  file: string,
  overrides: readonly string[] = [],
  sourceFile: (pointer: string) => string = () => file,
): { measurer: ToolMeasurer; diagnostics: Diagnostic[] } {
  const measurer = new ToolMeasurer(),
    diagnostics: Diagnostic[] = [];
  const visit = (doc: FontDocument, base = '') => {
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return;
    for (const [name, asset] of Object.entries(doc.assets ?? {}))
      if (
        asset &&
        typeof asset === 'object' &&
        asset.type === 'font' &&
        typeof asset.source === 'string' &&
        asset.export !== false
      ) {
        const pointer = base + '/assets/' + escape(name) + '/source';
        try {
          const font = new Font(fontBytes(asset.source, sourceFile(pointer)));
          measurer.register(name, font, asset.weight, asset.style);
          if (typeof asset.family === 'string')
            measurer.register(asset.family, font, asset.weight, asset.style);
          measurer.register(font.family, font, asset.weight, asset.style);
        } catch (e) {
          diagnostics.push(diagnostic(e, pointer));
        }
      }
    for (const [name, child] of Object.entries(doc.components ?? {}))
      visit(child, base + '/components/' + escape(name));
  };
  visit(doc);
  for (const entry of overrides) {
    const equal = entry.indexOf('=');
    try {
      if (equal <= 0) fault('--font needs family=path', 'font-option');
      const font = new Font(readFileSync(entry.slice(equal + 1)));
      const family = entry.slice(0, equal);
      measurer.fonts.delete(family.toLowerCase());
      measurer.register(family, font);
    } catch (e) {
      diagnostics.push(diagnostic(e, '/font'));
    }
  }
  const walk = (v: unknown, pointer = '') => {
    if (!v || typeof v !== 'object') return;
    const style = v as {
      font?: string;
      axes?: Record<string, number>;
      features?: Record<string, number>;
    };
    if (
      (style.axes || style.features) &&
      measurer.fonts.size &&
      /\/(?:styles|textStyles)\/[^/]+$/.test(pointer)
    ) {
      const spec = {
        family: style.font ?? 'sans-serif',
        size: 1,
        weight: 400,
        style: 'normal' as const,
        tracking: 0,
        axes: style.axes,
        features: style.features,
      };
      let font: Font | undefined;
      try {
        font = measurer.resolve(spec);
      } catch {
        /* Missing font preflight owns this error. */
      }
      if (font) {
        for (const tag of Object.keys(style.axes ?? {}))
          if (!font.axes.some((a) => a.tag === tag))
            diagnostics.push({
              code: 'font-axis',
              severity: 'error',
              pointer: pointer + '/axes/' + escape(tag),
              message: 'font has no variation axis ' + tag,
              hint: 'use an axis listed by anima inspect-font',
            });
        for (const tag of Object.keys(style.features ?? {}))
          if (!featureTags(font).has(tag))
            diagnostics.push({
              code: 'font-feature',
              severity: 'warning',
              pointer: pointer + '/features/' + escape(tag),
              message: 'font has no feature ' + tag,
              hint: 'choose a feature advertised by the font; absent features have no effect',
            });
      }
    }
    for (const [k, child] of Object.entries(v)) {
      const p = pointer + '/' + escape(k);
      if (k === 'text' && typeof child === 'string')
        diagnostics.push(...shapingDiagnostic(child, p));
      else walk(child, p);
    }
  };
  walk(doc);
  return { measurer, diagnostics };
}
/** Optional runtime seam. Does not import the text module into core or web. */
export async function installToolMeasurer(measurer: ToolMeasurer): Promise<void> {
  const actual = new URL('../../../../modules/text/core/measure.ts', import.meta.url);
  if (!existsSync(actual)) return;
  const module = (await import(actual.href)) as {
    setTextMeasurer?: (m: ToolMeasurer) => void;
    setMeasurer?: (m: ToolMeasurer) => void;
  };
  const install = module.setTextMeasurer ?? module.setMeasurer;
  if (!install) fault('text module must export setTextMeasurer(TextMeasurer)', 'font-contract');
  install(measurer);
}
export function buildFont(asset: FontAsset, doc: FontDocument, file: string): void {
  const bytes = fontBytes(asset.source, file),
    font = new Font(bytes),
    mode = asset.glyphs ?? 'all';
  if (
    !['used', 'all', 'custom'].includes(mode) ||
    (mode === 'custom' && typeof asset.chars !== 'string')
  )
    fault('font glyphs needs all, used, or custom with chars', 'font-glyphs');
  const result =
    mode === 'all'
      ? bytes
      : subsetFont(bytes, mode === 'custom' ? asset.chars! : documentCharacters(doc));
  // Selected fonts are embedded so the subset is actually stored even without --embed.
  if (mode !== 'all') {
    asset.source =
      `data:${font.flavor === 0x4f54544f ? 'font/otf' : 'font/ttf'};base64,` +
      result.toString('base64');
    asset.storage = 'embedded';
  }
  asset.mime =
    mode !== 'all'
      ? font.flavor === 0x4f54544f
        ? 'font/otf'
        : 'font/ttf'
      : bytes.subarray(0, 4).toString() === 'wOF2'
        ? 'font/woff2'
        : bytes.subarray(0, 4).toString() === 'wOFF'
          ? 'font/woff'
          : font.flavor === 0x4f54544f
            ? 'font/otf'
            : 'font/ttf';
  asset.size = result.length;
}
