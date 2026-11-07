import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fault, MAX_FONT } from './binary.ts';
import { normalizeFont } from './container.ts';
import { Font } from './reader.ts';
import { subsetFont } from './subset.ts';
export interface ImportedFont {
  source: string;
  type: 'font';
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  mime: string;
  size: number;
}
export function importFont(path: string, out: string, chars?: string): ImportedFont {
  const input = readFileSync(path),
    font = new Font(input),
    bytes = chars === undefined ? normalizeFont(input) : subsetFont(input, chars);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, bytes);
  return {
    type: 'font',
    family: font.family,
    weight: font.weight,
    style: font.style,
    source: out,
    mime: font.flavor === 0x4f54544f ? 'font/otf' : 'font/ttf',
    size: bytes.length,
  };
}
/** Explicit build-time network access. Tests supply a fake Fetch implementation. */
export async function googleFonts(
  query: string,
  out: string,
  chars?: string,
  fetcher: typeof fetch = fetch,
): Promise<ImportedFont[]> {
  if (!/^[\w +-]+(?::[a-zA-Z,]+@[\d.;,-]+)?$/.test(query))
    fault('invalid Google Fonts family/axis query', 'font-option');
  const url = new URL('https://fonts.googleapis.com/css2');
  url.searchParams.set('family', query);
  if (chars !== undefined) url.searchParams.set('text', chars);
  const get = async (url: string) => {
    const response = await fetcher(url);
    if (!response.ok) fault('font download failed: HTTP ' + response.status, 'font-download');
    const chunks: Buffer[] = [];
    let size = 0;
    if (!response.body) return Buffer.alloc(0);
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_FONT) {
          await reader.cancel();
          fault('font download exceeds limit', 'font-limit');
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    return Buffer.concat(chunks);
  };
  let css: Buffer;
  try {
    css = await get(url.href);
  } catch (e) {
    if (e instanceof Error && 'code' in e && String(e.code).startsWith('font-')) throw e;
    fault('cannot fetch Google Fonts CSS', 'font-download');
  }
  const sources = [
    ...new Set(
      [
        ...css
          .toString('utf8')
          .matchAll(/url\(\s*['"]?(https:\/\/fonts\.gstatic\.com\/[^\s'"()]+)['"]?\s*\)/g),
      ].map((m) => m[1]!),
    ),
  ];
  if (!sources.length) fault('Google Fonts returned no supported font sources', 'font-download');
  const results: ImportedFont[] = [];
  for (const [i, source] of sources.entries()) {
    let bytes: Buffer;
    try {
      bytes = await get(source);
    } catch (e) {
      if (e instanceof Error && 'code' in e && String(e.code).startsWith('font-')) throw e;
      fault('cannot fetch Google Fonts font bytes', 'font-download');
    }
    const font = new Font(bytes),
      result = chars === undefined ? normalizeFont(bytes) : subsetFont(bytes, chars),
      file = sources.length === 1 ? out : out.replace(/(\.[^./]+)?$/, `-${i + 1}$1`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, result);
    results.push({
      type: 'font',
      family: font.family,
      weight: font.weight,
      style: font.style,
      source: file,
      mime: font.flavor === 0x4f54544f ? 'font/otf' : 'font/ttf',
      size: result.length,
    });
  }
  return results;
}
