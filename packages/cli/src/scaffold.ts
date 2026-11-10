// `anima new`: a .ani whose rest frame is the glyph SVG, from a glyph file or a Glyphy project.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { importSVG } from './import-svg.ts';

export const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

export interface GlyphSource {
  d: string;
  grid: number;
  meta: Record<string, unknown>;
  pick?: string;
  source: string;
}

function legacyGlyphSVG(text: string, file: string): GlyphSource {
  const paths = [...text.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)];
  if (paths.length !== 1)
    throw new Error(`${file}: expected exactly one <path>, found ${paths.length}`);
  const vb = /viewBox="([^"]+)"/
    .exec(text)?.[1]
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (!vb || vb.length !== 4 || vb[0] !== 0 || vb[1] !== 0 || vb[2] !== vb[3])
    throw new Error(`${file}: expected a square viewBox from 0 0 (a glyph grid)`);
  return { d: paths[0]![1]!, grid: vb[2]!, meta: {}, source: 'svg' };
}

/** Read a Glyphy-style glyph SVG: one path, square viewBox from 0. */
export function readGlyphSVG(file: string): GlyphSource {
  const text = readFileSync(file, 'utf8');
  importSVG(text, nameFromFile(file));
  return legacyGlyphSVG(text, file);
}

/** Just enough TOML for glyphy.toml: [sections], key = string | number | bool | [array]. */
export function parseToml(text: string): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = { '': {} };
  let sec = out['']!;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!.replace(/(^|\s)#.*$/, '').trim();
    if (!line) continue;
    const s = /^\[([^\]]+)\]$/.exec(line);
    if (s) {
      sec = out[s[1]!.trim()] ??= {};
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim().replace(/^"|"$/g, '');
    let raw = line.slice(eq + 1).trim();
    while (raw.startsWith('[') && !raw.endsWith(']') && i + 1 < lines.length)
      raw += ' ' + lines[++i]!.replace(/#.*$/, '').trim();
    line = raw.replace(/,\s*]$/, ']');
    try {
      sec[key] = JSON.parse(line.replace(/'/g, '"'));
    } catch {
      sec[key] = line;
    }
  }
  return out;
}

/** Read a glyph from a Glyphy project directory (glyphy.toml + its picked glyphs folder). */
export function readGlyphy(dir: string, name: string): GlyphSource {
  const tomlFile = join(dir, 'glyphy.toml');
  if (!existsSync(tomlFile)) throw new Error(`${dir}: no glyphy.toml`);
  const toml = parseToml(readFileSync(tomlFile, 'utf8'));
  const picked = (toml.paths?.picked as string | undefined) ?? 'glyphs';
  const candidates = [
    join(dir, picked, `${name}.svg`),
    join(dir, 'glyphs', `${name}.svg`),
    join(dir, `${name}.svg`),
  ];
  const file = candidates.find(existsSync);
  if (!file) throw new Error(`${dir}: no ${name}.svg in ${picked}/`);
  const g = readGlyphSVG(file);
  const grid = (toml.style?.grid as number | undefined) ?? g.grid;
  if (grid !== g.grid)
    throw new Error(`${file}: viewBox ${g.grid} does not match style.grid ${grid}`);
  const info = toml[`glyphs.${name}`] ?? {};
  const meta: Record<string, unknown> = {
    glyphy: {
      ...(info.concept ? { concept: info.concept } : {}),
      ...(info.kind ? { kind: info.kind } : {}),
      ...(toml.style?.stroke ? { stroke: toml.style.stroke } : {}),
    },
  };
  const pick = toml.picks?.[name] as string | undefined;
  return { ...g, grid, meta, pick, source: 'glyphy' };
}

/** A minimal document: the glyph as one path, ink = currentColor, no motion yet. */
export function newDoc(name: string, g: GlyphSource): Record<string, unknown> {
  const glyph: Record<string, unknown> = {
    source: g.source,
    ...(g.pick ? { pick: g.pick } : {}),
    sha256: sha256(g.d),
    d: g.d,
  };
  // Glyph names start with a letter (NAME); document names may start with a digit.
  const key = /^[a-z]/.test(name) ? name : 'glyph-' + name;
  return {
    anima: '0.1',
    name,
    title: name.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()),
    grid: g.grid,
    ...(Object.keys(g.meta).length ? { meta: g.meta } : {}),
    colors: { ink: 'currentColor' },
    glyphs: { [key]: glyph },
    nodes: [{ id: 'glyph', type: 'path', glyph: key, fill: { color: 'ink', rule: 'evenodd' } }],
  };
}

export const nameFromFile = (file: string) => basename(file).replace(/\.svg$/, '');

/** Scaffold a standalone SVG through the importer, retaining the legacy one-path output shape. */
export function scaffoldSVG(file: string, name: string) {
  const source = readFileSync(file, 'utf8');
  const imported = importSVG(source, name);
  const leaves: Record<string, unknown>[] = [];
  const collect = (nodes: unknown): void => {
    if (!Array.isArray(nodes)) return;
    for (const value of nodes) {
      if (!value || typeof value !== 'object') continue;
      const node = value as Record<string, unknown>;
      if (node.type === 'group') collect(node.children);
      else leaves.push(node);
    }
  };
  collect(imported.doc.nodes);
  if (leaves.length === 1 && leaves[0]?.type === 'path') {
    try {
      const glyph = legacyGlyphSVG(source, file);
      return {
        doc: newDoc(name, glyph),
        diagnostics: imported.diagnostics,
        glyph,
        subpaths: (glyph.d.match(/[Mm]/g) ?? []).length,
      };
    } catch {
      // Non-glyph geometry (for example a non-square viewBox) keeps the importer's document.
    }
  }
  const subpaths = leaves.reduce(
    (count, node) =>
      count + (typeof node.d === 'string' ? Math.max(1, (node.d.match(/[Mm]/g) ?? []).length) : 1),
    0,
  );
  return { doc: imported.doc, diagnostics: imported.diagnostics, subpaths };
}
