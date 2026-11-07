import { documentFonts, installToolMeasurer } from './font/document.ts';
import { ToolMeasurer } from './font/measure.ts';
import { outlineSVG } from './font/svg.ts';
import { browserTextPNG, embedFontCSS } from './font/browser.ts';
import { importFont, googleFonts } from './font/import.ts';
import { flattenText } from './font/flatten.ts';
import { createScriptSession } from '../../core/src/script.ts';
import { resolve, basename } from 'node:path';
import { findProject, projectSource, substituteConstants } from './project.ts';
import { doctor } from './doctor.ts';
import { comparePNG } from './compare-png.ts';
import { mixAudio } from './audio.ts';
import { viewportSVG, probePNG } from './render-options.ts';
import { wiringSummary } from './inspect-summary.ts';
import { listState } from '../../../modules/lists/core/index.ts';
import '@anima-format/core/all';
// The `anima` command line (ARCHITECTURE §cli). Every command takes --format=json; exit codes are
// 0 ok, 1 diagnostics or a failed check, 2 usage.

import { mkdirSync, cpSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  Player,
  type Diagnostic,
  type Model,
  type Shape,
  DOC,
  markupName,
  COMMON,
  NODE_TYPES,
  ELEMENTS,
  OWN,
  PAINT,
  PAINTED,
  nodeShape,
  STATIC,
  ScriptError,
  jsonSchema,
  load,
  runScript,
  staticSlots,
} from '@anima-format/core';
import { formatAni as format } from '@anima-format/core';
import { compile, decompile, formatMarkup, type MarkupDiagnostic } from '@anima-format/markup';
import { nodeAttrs } from '../../markup/src/names.ts';
import { session } from './session.ts';
import { bench } from './bench.ts';
import { startPlayground } from './playground.ts';
import { inspectGlyph } from './glyphs.ts';
import { embedAssets, imageDimensions } from './assets.ts';
import { buildHTML } from './html.ts';
import { buildAssets } from './build-assets.ts';
import { updateLibraries } from './library.ts';
import { ImageEncoder } from './encode.ts';
import { importSVG } from './import-svg.ts';
import { importLottie } from './import-lottie.ts';
import { lineCol, locate, syntaxErrorAt } from './locate.ts';
import { DARK, LIGHT, type Look, compareSVG, frameSVG, sheetSVG, toPNG } from './render.ts';
import { nameFromFile, newDoc, readGlyphSVG, readGlyphy, sha256 } from './scaffold.ts';

export interface IO {
  out(s: string): void;
  err(s: string): void;
  /** Exact stdout bytes for compiled artifacts (out is line-oriented). */
  write?(s: string): void;
  input?: AsyncIterable<string>;
}

class Usage extends Error {}

const ROOT = new URL('../../../', import.meta.url);

const HELP = `anima — check, see and scaffold .animl and .ani animations

  anima playground [file.animl] [--port 4519]  local live editor (built-in bell is read-only)
  anima import-font <font> -o local.ttf [--chars "ABC"]  store/subset a font
  anima import-font --google "Family:wght@400;600" -o local.ttf  fetch at build time
  anima flatten <file> [--node id] [-o out.ani] [--font name=path]  text to outlines
  anima validate <file>                 all diagnostics, with JSON pointers, lines and hints
  anima inspect <file>                  nodes, glyph subpaths and bounds, timelines, state graph
  anima sample <file> [-s script | -e "cmds"] [--reduced-motion] [--all] [--semantics] [--seed N]
                                        run a script (spec §11.2), print snapshots as JSON lines
  anima session <file>                 persistent JSON-line script session (reload, quit)
  anima bench <file> [-s script] [--frames N] [--format=json]  compile and frame costs
  anima render <file> -o out.svg|png [--at t] [-s script | -e "cmds"] [--size px]
               [--sheet N [--over seconds]] [--dark] [--color slot=#hex] [--current #hex]
               [--background #hex] [--font name=path] [--browser-text] draw a frame or a labelled contact sheet
  anima render <file> --compare glyph.svg [--at t] [-s script | -e "cmds"]
               [--size px] [--tolerance 0..255] [-o diff.png]
                                        compare RGBA pixels (default 256px, black currentColor,
                                        transparent background); exit 1 beyond tolerance (default 0)
  anima compare a.png b.png [--tolerance 0..255] [-o diff.png]  compare output RGBA pixels
  anima doctor                          check Node, browsers, cache and module wiring
  anima render [file] [--component name] [--fit contain|cover|fill|none] [--viewport WxH]
               [--frames N] [--fps N] [--scale k] [--probe 'x,y;x,y'] [--preset name] [--audio out.wav]
  anima inspect [file] --summary         wiring diagnostics table
  anima schema --search <words> | <type>.<field>
               [--animatable] [--bindable] [--inherited] [--editor-only]
  anima new <directory> --sample bell|moon|progress
  anima build [file] --out-dir <directory>  local HTML and runtime export
  anima fmt <file> [--write | --check]  canonical formatting
  anima new <name> --glyph <file.svg> | --glyphy <project-dir> [-o out.animl] [--ani] [--force]
                                        scaffold AniML whose rest frame is the glyph (--ani for JSON)
  anima build <file.animl|page.html> [-o out] [--embed]  compile AniML to canonical .ani or inline JSON
  anima import <file.svg|file.json> [-o out.animl]  import supported SVG or Lottie features
  anima library update <file.animl> [--check]  refresh vendored imports from local source paths
  anima decompile <file.ani> [-o out.animl]    write canonical AniML
  anima schema [type | fill | stroke | a11y | timeline | layer | state | pose | transition | listener | input] [--json-schema]
                                        registry fields, types and markup/.ani spellings
  anima docs [authoring | spec | markup | <section>] [section-slug] [--list]
                                        the authoring guide and the spec

Script commands: semantics [id]; semantic <id> tap|increase|decrease|focus; snapshot --semantics.

Authoring commands accept .animl and .ani. Every command takes --format=json. Exit codes: 0 ok, 1 diagnostics, 2 usage.`;

export async function run(argv: string[], io: IO): Promise<number> {
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        font: { type: 'string', multiple: true },
        'browser-text': { type: 'boolean' },
        google: { type: 'string' },
        chars: { type: 'string' },
        node: { type: 'string' },
        component: { type: 'string' },
        fit: { type: 'string' },
        viewport: { type: 'string' },
        scale: { type: 'string' },
        probe: { type: 'string' },
        preset: { type: 'string', multiple: true },
        fps: { type: 'string' },
        animatable: { type: 'boolean' },
        bindable: { type: 'boolean' },
        inherited: { type: 'boolean' },
        'editor-only': { type: 'boolean' },
        audio: { type: 'string' },
        search: { type: 'string' },
        summary: { type: 'boolean' },
        sample: { type: 'string' },
        'out-dir': { type: 'string' },
        port: { type: 'string' },
        format: { type: 'string', default: 'text' },
        script: { type: 'string', short: 's' },
        eval: { type: 'string', short: 'e' },
        'reduced-motion': { type: 'boolean' },
        all: { type: 'boolean' },
        semantics: { type: 'boolean' },
        seed: { type: 'string' },
        frames: { type: 'string' },
        out: { type: 'string', short: 'o' },
        at: { type: 'string' },
        size: { type: 'string' },
        sheet: { type: 'string' },
        over: { type: 'string' },
        dark: { type: 'boolean' },
        color: { type: 'string', multiple: true },
        current: { type: 'string' },
        background: { type: 'string' },
        compare: { type: 'string' },
        tolerance: { type: 'string' },
        write: { type: 'boolean' },
        check: { type: 'boolean' },
        glyph: { type: 'string' },
        glyphy: { type: 'string' },
        force: { type: 'boolean' },
        ani: { type: 'boolean' },
        embed: { type: 'boolean' },
        'json-schema': { type: 'boolean' },
        list: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (e) {
    io.err(`${(e as Error).message}\n\n${HELP}`);
    return 2;
  }
  const { values: o, positionals: pos } = args;
  const [cmd, ...rest] = pos;
  const json = o.format === 'json';
  if (o.format !== 'text' && !json) return (io.err('--format is text or json'), 2);
  if (!cmd || o.help) return (io.out(HELP), cmd || o.help ? 0 : 2);
  const emit = (v: unknown) => io.out(JSON.stringify(v, null, json ? undefined : 2));
  try {
    let fonts = { measurer: new ToolMeasurer(), diagnostics: [] as Diagnostic[] };
    if (['sample', 'validate', 'render', 'flatten', 'build'].includes(cmd)) {
      const f = file(rest),
        source = projectSource(f);
      let doc: unknown;
      let sourceMap: Map<string, import('@anima-format/markup').Pos> | undefined;
      if (f.endsWith('.animl'))
        ({ doc, map: sourceMap } = compile(source, {
          file: f,
          validate: false,
          resolve: (path) =>
            substituteConstants(readFileSync(path, 'utf8'), findProject()?.constants),
        }));
      else {
        try {
          doc = JSON.parse(source);
        } catch {
          /* normal validation owns syntax diagnostics */
        }
      }
      if (
        doc &&
        typeof doc === 'object' &&
        (o.font?.length ||
          ('requires' in doc &&
            Array.isArray(doc.requires) &&
            doc.requires.some((r: unknown) => r === 'text' || r === 'fonts')))
      )
        fonts = documentFonts(doc, f, o.font, (pointer) => sourceMap?.get(pointer)?.file ?? f);
      if (fonts.diagnostics.some((d) => d.severity === 'error')) {
        if (json) emit({ file: f, ok: false, diagnostics: fonts.diagnostics });
        else report(f, fonts.diagnostics, io);
        return 1;
      }
      fonts.measurer.onDiagnostic = (diagnostic) => {
        if (fonts.diagnostics.some((d) => d.code === diagnostic.code)) return;
        fonts.diagnostics.push(diagnostic);
        if (cmd !== 'validate') report(f, [diagnostic], io);
      };
      await installToolMeasurer(fonts.measurer);
      if (cmd !== 'validate') report(f, fonts.diagnostics, io);
    }
    switch (cmd) {
      case 'doctor': {
        const result = await doctor();
        if (json) emit(result);
        else
          for (const c of result.checks)
            io.out(
              `${c.pass ? 'PASS' : 'FAIL'} ${c.name}: ${c.message}${c.pass ? '' : '; hint: ' + c.hint}`,
            );
        return result.ok ? 0 : 1;
      }
      case 'compare': {
        if (rest.length !== 2 || !rest.every((p) => p.endsWith('.png')))
          throw new Usage('compare needs two PNG files');
        const tolerance = Number(o.tolerance ?? 0);
        if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 255)
          throw new Usage('--tolerance must be an integer from 0 to 255');
        if (o.out && !o.out.endsWith('.png')) throw new Usage('compare output must be .png');
        const { diff, ...metrics } = comparePNG(
          readFileSync(rest[0]!),
          readFileSync(rest[1]!),
          tolerance,
          !!o.out,
        );
        if (o.out) writeFileSync(o.out, diff!);
        emit({ ...metrics, tolerance, ...(o.out ? { wrote: o.out } : {}) });
        return metrics.pass ? 0 : 1;
      }
      case 'playground': {
        if (rest.length > 1) throw new Usage('playground takes at most one .animl file');
        const port = o.port === undefined ? 4519 : Number(o.port);
        if (!Number.isInteger(port) || port < 0 || port > 65535)
          throw new Usage('--port takes an integer from 0 to 65535');
        const host = await startPlayground({ file: rest[0] ?? findProject()?.entry, port });
        if (json) emit({ url: host.url, writable: !!rest[0] });
        else io.out(`Anima Playground: ${host.url}${rest[0] ? '' : ' (example is read-only)'}`);
        return 0;
      }
      case 'library': {
        if (rest[0] !== 'update' || rest.length > 2)
          throw new Usage('library update needs an AniML file');
        try {
          const updates = updateLibraries(file(rest.slice(1)), !!o.check);
          if (json) emit({ updates });
          else
            for (const u of updates)
              io.out(`${u.changed ? (o.check ? 'stale' : 'updated') : 'current'} ${u.file}`);
          return o.check && updates.some((u) => u.changed) ? 1 : 0;
        } catch (e) {
          const error = e as Error & { code?: string; pointer?: string; hint?: string };
          const diagnostic = {
            code: error.code ?? 'library-source',
            pointer: error.pointer ?? '',
            message: error.message,
            hint: error.hint ?? 'check local import src and source paths',
            severity: 'error',
          };
          if (json) emit({ diagnostics: [diagnostic] });
          else
            io.err(
              `${diagnostic.code} ${diagnostic.pointer}: ${diagnostic.message}; ${diagnostic.hint}`,
            );
          return 1;
        }
      }
      case 'validate':
        return validate(file(rest), json, io, fonts.diagnostics);
      case 'inspect':
        return inspect(file(rest), json, io, !!o.summary);
      case 'sample': {
        const { model } = loaded(file(rest), io, json);
        if (!model) return 1;
        const script = scriptText(o.script, o.eval) ?? 'snapshot';
        const result = runScript(model, script, scriptOptions(o));
        for (const item of result.output) io.out(JSON.stringify(item));
        for (const d of result.diagnostics) io.err(JSON.stringify(d));
        return result.diagnostics.length ? 1 : 0;
      }
      case 'session': {
        const f = file(rest);
        if (rest.length !== 1) throw new Usage('session takes one file');
        return await session(() => check(f).model, io, scriptOptions(o));
      }
      case 'bench': {
        const f = file(rest);
        const frames = o.frames === undefined ? 600 : Number(o.frames);
        if (rest.length !== 1 || !Number.isInteger(frames) || frames < 1 || frames > 1000000)
          throw new Usage('bench --frames needs an integer from 1 to 1000000 and one file');
        const result = bench(
          () => loaded(f, io, json).model,
          scriptText(o.script, o.eval) ?? '',
          frames,
          scriptOptions(o),
        );
        if (!result) return 1;
        if (json || 'diagnostics' in result) io.out(JSON.stringify(result));
        else
          io.out(
            `compile ${result.compileMs.toFixed(3)} ms; ${result.frames} frames; step median ${result.step.median.toFixed(3)} µs p95 ${result.step.p95.toFixed(3)} µs; draw median ${result.draw.median.toFixed(3)} µs p95 ${result.draw.p95.toFixed(3)} µs; JS heap growth ${result.memory.growthBytes} B (${result.memory.bytesPerFrame.toFixed(2)} B/frame)`,
          );
        return 'diagnostics' in result ? 1 : 0;
      }
      case 'render': {
        const names = o.preset ?? [];
        const presets = names.map((name) => {
          const preset = findProject()?.presets?.[name];
          if (!preset) throw new Usage('unknown render preset ' + name);
          return preset;
        });
        const explicit = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
        for (let i = 0; i < Math.max(1, presets.length); i++) {
          const output =
            presets.length > 1 && o.out
              ? o.out.replace(/(\.[^.]+)$/, '-' + names[i] + '$1')
              : o.out;
          const result = await render(
            file(rest),
            { ...presets[i], ...explicit, out: output },
            json,
            io,
            fonts.measurer,
          );
          if (result) return result;
        }
        return 0;
      }
      case 'import-font': {
        if (!o.out) throw new Usage('import-font needs -o local.ttf|otf');
        if (o.google ? rest.length !== 0 : rest.length !== 1)
          throw new Usage('import-font takes a font file or --google family:axes@values');
        const assets = o.google
          ? await googleFonts(o.google, o.out, o.chars)
          : [importFont(file(rest), o.out, o.chars)];
        emit({ assets });
        return 0;
      }
      case 'flatten': {
        const f = file(rest),
          result = loaded(f, io, json);
        if (!result.model) return 1;
        const doc = flattenText(JSON.parse(result.text), fonts.measurer, o.node),
          text = format(doc);
        if (o.out) writeFileSync(o.out, o.out.endsWith('.animl') ? decompile(text) : text);
        else if (io.write) io.write(text);
        else io.out(text);
        if (json && o.out) emit({ wrote: o.out });
        return 0;
      }
      case 'build': {
        const dir = o['out-dir'] ?? (!o.out ? findProject()?.out : undefined);
        if (dir) return await exportProject(file(rest), dir, json, io);
        return await build(file(rest), o.out, json, io, o.embed);
      }
      case 'import': {
        const f = file(rest);
        const name =
          nameFromFile(f.replace(/\.(svg|json)$/i, '.svg'))
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'imported';
        const source = readFileSync(f, 'utf8');
        if (!/\.(svg|json)$/i.test(f)) throw new Usage('import needs a .svg or Lottie .json file');
        let imported: import('./import-svg.ts').Imported;
        try {
          imported = /\.svg$/i.test(f) ? importSVG(source, name) : importLottie(source, name);
        } catch (error) {
          const diagnostics = [
            {
              code: 'import-invalid',
              severity: 'error' as const,
              pointer: '',
              message: error instanceof Error ? error.message : 'invalid source document',
              hint: 'provide a well-formed SVG or Lottie animation with a positive viewBox/frame rate',
            },
          ];
          if (json) io.out(JSON.stringify({ file: f, ok: false, diagnostics }));
          else report(f, diagnostics, io);
          return 1;
        }
        const checked = load(imported.doc);
        const diagnostics = [...imported.diagnostics, ...checked.diagnostics];
        if (diagnostics.some((d) => d.severity === 'error')) {
          if (json) io.out(JSON.stringify({ file: f, ok: false, diagnostics }));
          else report(f, diagnostics, io);
          return 1;
        }
        const text = decompile(format(imported.doc));
        if (o.out) writeFileSync(o.out, text);
        if (json)
          io.out(
            JSON.stringify({
              file: f,
              ok: true,
              diagnostics,
              ...(o.out ? { wrote: o.out } : { text }),
            }),
          );
        else {
          report(f, diagnostics, io);
          if (!o.out) io.out(text.trimEnd());
        }
        return 0;
      }
      case 'decompile': {
        const f = file(rest);
        const r = loaded(f, io, json);
        if (!r.model) return 1;
        const text = decompile(r.text);
        if (o.out) writeFileSync(o.out, text);
        else io.out(text.trimEnd());
        return 0;
      }
      case 'fmt': {
        const f = file(rest);
        const text = readFileSync(f, 'utf8');
        let out: string;
        if (f.endsWith('.animl')) {
          const r = formatMarkup(text);
          const diagnostics = r.diagnostics.map((d) => ({ ...d, file: f }));
          if (!r.text) {
            if (json) emit({ file: f, ok: false, diagnostics });
            else report(f, diagnostics, io);
            return 1;
          }
          out = r.text;
        } else {
          let doc;
          try {
            doc = JSON.parse(text);
          } catch (e) {
            io.err(`${f}: not JSON: ${(e as Error).message}`);
            return 1;
          }
          out = format(doc);
        }
        if (o.check) {
          if (json) emit({ file: f, formatted: out === text });
          else
            io.out(
              out === text ? `${f}: formatted` : `${f}: not formatted (run anima fmt --write)`,
            );
          return out === text ? 0 : 1;
        }
        if (o.write) {
          writeFileSync(f, out);
          if (json) emit({ wrote: f });
          return 0;
        }
        io.out(out.trimEnd());
        return 0;
      }
      case 'new':
        return o.sample ? sampleProject(rest, o, json, io) : scaffold(rest, o, json, io);
      case 'schema':
        if (o.animatable || o.bindable || o.inherited || o['editor-only'])
          return filteredSchema(rest[0], o, json, io);
        return o.search
          ? schemaSearch(o.search, json, io)
          : schema(rest[0], !!o['json-schema'], json, io);
      case 'docs':
        return docs(rest[0], !!o.list, json, io, rest[1]);
      default:
        throw new Usage(`unknown command "${cmd}"`);
    }
  } catch (e) {
    if (e instanceof Usage) {
      io.err(`${e.message}\n\n${HELP}`);
      return 2;
    }
    if (e instanceof ScriptError) {
      io.err(
        JSON.stringify({ code: e.code, pointer: e.pointer, message: e.message, hint: e.hint }),
      );
      return 2;
    }
    const error = e as Error & { code?: string; pointer?: string; hint?: string };
    if (error.code) {
      const diagnostic = {
        code: error.code,
        pointer: error.pointer ?? '',
        message: error.message,
        hint: error.hint ?? 'check local files and browser installation',
      };
      if (json) emit({ diagnostics: [diagnostic] });
      else
        io.err(
          `${diagnostic.code} ${diagnostic.pointer}: ${diagnostic.message}; hint: ${diagnostic.hint}`,
        );
    } else io.err(error.message);
    return 1;
  }
}

function file(rest: string[]): string {
  const f = rest[0] ?? findProject()?.entry;
  if (!f) throw new Usage('missing <file>');
  if (!existsSync(f)) throw new Usage(`no such file: ${f}`);
  return f;
}

function scriptOptions(o: Record<string, unknown>) {
  const seed = o.seed === undefined ? undefined : Number(o.seed);
  if (seed !== undefined && (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff))
    throw new Usage('--seed needs a uint32 integer');
  return { reducedMotion: !!o['reduced-motion'], all: !!o.all, semantics: !!o.semantics, seed };
}

function scriptText(file?: string, inline?: string): string | undefined {
  if (file && inline) throw new Usage('use --script or -e, not both');
  if (file) return readFileSync(file, 'utf8');
  return inline?.replace(/;/g, '\n');
}

interface Located extends Diagnostic {
  file?: string;
  line?: number;
  column?: number;
}

/** Load with the CLI-only checks (duplicate keys, glyph hashes) and source positions. */
// Tooling guidance only: preserve the grammar, including declared hyphenated paths.
function subtractionHints<T extends Diagnostic>(diagnostics: T[]): T[] {
  const ambiguous = diagnostics.flatMap((d) => {
    const match = d.code === 'data-path' && /unknown data path (\$[\w:.-]+)-(\d+)$/.exec(d.message);
    return match ? [{ diagnostic: d, path: match[1]!, number: match[2]! }] : [];
  });
  return diagnostics
    .filter(
      (d) =>
        !ambiguous.some(
          ({ diagnostic, path, number }) =>
            d.code === 'unknown-input' &&
            d.pointer === diagnostic.pointer &&
            d.message.includes(path + '-' + number),
        ),
    )
    .map((d) => {
      const entry = ambiguous.find(({ diagnostic }) => diagnostic === d);
      return entry
        ? {
            ...d,
            hint: `write \`${entry.path} - ${entry.number}\` (spaces around the minus): names may contain hyphens`,
          }
        : d;
    });
}

function check(f: string): { model?: Model; diagnostics: Located[]; text: string } {
  const text = projectSource(f);
  if (f.endsWith('.animl')) {
    const c = compile(text, {
      file: f,
      resolve: (path) => substituteConstants(readFileSync(path, 'utf8'), findProject()?.constants),
    });
    const diagnostics = subtractionHints(c.diagnostics);
    if (c.doc) {
      for (const d of glyphDiagnostics(c.doc)) {
        let pointer = d.pointer;
        while (!c.map.has(pointer) && pointer) pointer = pointer.slice(0, pointer.lastIndexOf('/'));
        const pos = c.map.get(pointer);
        diagnostics.push({ ...d, file: f, line: pos?.line, column: pos?.col });
      }
    }
    return { model: c.text ? load(c.text).model : undefined, diagnostics, text: c.text ?? '' };
  }
  const r = load(text);
  const diagnostics: Located[] = subtractionHints(r.diagnostics);
  let at = new Map<string, number>();
  try {
    JSON.parse(text);
    const loc = locate(text);
    at = loc.at;
    for (const d of loc.duplicates)
      diagnostics.unshift({
        code: 'duplicate-key',
        severity: 'error',
        pointer: d.pointer,
        message: 'this key appears twice in its object; JSON parsers keep only the last',
        hint: 'remove or merge one of them',
      });
    const doc = JSON.parse(text);
    diagnostics.push(...glyphDiagnostics(doc));
  } catch {
    /* json-syntax is already reported */
  }
  for (const d of diagnostics) {
    const off = d.code === 'json-syntax' ? syntaxErrorAt(text) : at.get(d.pointer);
    if (off !== undefined && off !== null) [d.line, d.column] = lineCol(text, off);
  }
  const failed = diagnostics.some((d) => d.severity === 'error');
  return { model: failed ? undefined : r.model, diagnostics, text };
}

function glyphDiagnostics(doc: Record<string, unknown>): Located[] {
  const diagnostics: Located[] = [];
  for (const [name, g] of Object.entries(
    (doc?.glyphs ?? {}) as Record<string, { d?: unknown; sha256?: unknown }>,
  ))
    if (typeof g?.sha256 === 'string' && typeof g.d === 'string' && sha256(g.d) !== g.sha256)
      diagnostics.push({
        code: 'hash-mismatch',
        severity: 'warning',
        pointer: `/glyphs/${name}/sha256`,
        message: `glyph "${name}" changed since its hash was taken`,
        hint: 'if it was re-traced, check that subpath indices still pick the right parts, then update sha256',
      });
  return diagnostics;
}

function loaded(
  f: string,
  io: IO,
  json = false,
): { model?: Model; text: string; diagnostics: Located[] } {
  const r = check(f);
  if (!r.model) {
    if (json && f.endsWith('.animl'))
      io.out(JSON.stringify({ file: f, ok: false, diagnostics: r.diagnostics }));
    else report(f, r.diagnostics, io);
    io.err(`${f}: fix the errors above first (anima validate ${f})`);
  }
  return r;
}

function report(f: string, ds: Located[], io: IO): void {
  for (const d of ds) {
    const where = d.line ? `${d.file ?? f}:${d.line}:${d.column}` : (d.file ?? f);
    for (const r of (d as MarkupDiagnostic).related ?? [])
      io.err(`  related: ${r.file ?? f}:${r.line}:${r.column}`);
    if (d.file) {
      io.err(`${where} ${d.severity} ${d.code} ${d.message}`);
      if (d.hint) io.err(`  hint: ${d.hint}`);
      continue;
    }
    io.err(
      `${where} ${d.severity} ${d.code} ${d.pointer || '/'}: ${d.message}${d.hint ? ` — ${d.hint}` : ''}`,
    );
  }
}

function validate(f: string, json: boolean, io: IO, extra: Diagnostic[] = []): number {
  const { model, diagnostics } = check(f);
  diagnostics.push(...extra);
  if (json) io.out(JSON.stringify({ file: f, ok: !!model, diagnostics }));
  else {
    report(f, diagnostics, io);
    const errors = diagnostics.filter((d) => d.severity === 'error').length;
    const warnings = diagnostics.length - errors;
    io.out(
      model
        ? `${f}: ok${warnings ? ` (${warnings} warning${warnings > 1 ? 's' : ''})` : ''}`
        : `${f}: ${errors} error${errors > 1 ? 's' : ''}${warnings ? `, ${warnings} warning${warnings > 1 ? 's' : ''}` : ''}`,
    );
  }
  return model ? 0 : 1;
}

// ---------------------------------------------------------------- inspect

function inspect(f: string, json: boolean, io: IO, summaryOnly = false): number {
  const { model, diagnostics } = loaded(f, io, json);
  if (!model) return 1;
  if (summaryOnly) {
    const wiring = wiringSummary(model, diagnostics);
    if (json) io.out(JSON.stringify({ wiring }));
    else
      io.out(
        [
          'code\tpointer\tmessage\thint',
          ...wiring.map((d) => `${d.code}\t${d.pointer}\t${d.message}\t${d.hint}`),
        ].join('\n'),
      );
    return 0;
  }
  const m = model;
  const doc = m.doc;
  const node = (i: number): object => {
    const n = m.nodes[i]!;
    const animated = [...m.addrs.keys()]
      .filter((a) => a.startsWith(n.id + '.'))
      .map((a) => a.slice(n.id.length + 1));
    return {
      id: n.id,
      type: n.type,
      ...(n.raw.component ? { component: n.raw.component } : {}),
      ...(n.raw.glyph ? { glyph: n.raw.glyph, subpaths: n.raw.subpaths ?? 'all' } : {}),
      ...(n.raw.pivot ? { pivot: n.raw.pivot } : {}),
      ...(animated.length ? { animated } : {}),
      ...(n.raw.knockout !== undefined ? { knockout: n.raw.knockout } : {}),
      ...(n.children.length ? { children: n.children.map(node) } : {}),
    };
  };
  const writers = new Map<string, string[]>();
  const layers = m.layers.map((l) => {
    const writes = [...new Set(l.states.flatMap((s) => s.writes))];
    for (const a of writes) writers.set(a, [...(writers.get(a) ?? []), l.name]);
    return {
      name: l.name,
      initial: l.states[l.initial]!.name,
      writes,
      states: l.states.map((s) => ({
        name: s.name,
        kind: doc.machine.layers[l.name].states[s.name].kind,
        ...(s.play !== undefined
          ? { play: m.timelines[s.play]!.name }
          : {
              pose: Object.fromEntries(
                [...s.pose!].map(([k, v]) => [
                  k,
                  Array.isArray(v)
                    ? `#${v.map((c) => c.toString(16).padStart(2, '0')).join('')}`
                    : v,
                ]),
              ),
            }),
        ...(s.emit ? { emit: s.emit } : {}),
        on: (doc.machine.layers[l.name].states[s.name].on ?? []).map(
          (t: { when: string; to: string; blend?: number }) =>
            `${t.when} → ${t.to}${t.blend ? ` (${t.blend}s)` : ''}`,
        ),
        ...(s.on.length ||
        l.states.some(
          (a) => doc.machine.layers[l.name].states[a.name].kind === 'any' && a.on.length,
        )
          ? {}
          : { deadEnd: true }),
      })),
    };
  });
  const preview = new Player(m);
  preview.step(0);
  const instances = preview.inspect().filter((l) => l.layer.includes('/'));
  const slots = new Map<string, string>();
  const inputs = (player: Player, prefix = '') => {
    const repeated = listState(player)?.runs ?? [];
    const ids = repeated.map((r) => player.model.nodes[r.spec.node]!.id + '.');
    for (const name of player.model.inputs.keys())
      if (!(prefix && name.startsWith('$')) && !ids.some((id) => name.startsWith(id)))
        slots.set(prefix + name, player.model.inputs.get(name)!.type);
    for (const run of repeated) {
      for (const item of run.items)
        inputs(
          item.player,
          prefix + player.model.nodes[run.spec.node]!.id + '.' + item.index + '.',
        );
      const base = prefix + player.model.nodes[run.spec.node]!.id + '.';
      for (const name of slots.keys())
        if (
          name.startsWith(base) &&
          !run.items.some((item) => name.startsWith(base + item.index + '.'))
        )
          slots.delete(name);
    }
    for (const [id, child] of (player.nested as { players?: Map<string, Player> } | undefined)
      ?.players ?? [])
      inputs(child, prefix + id + '.');
  };
  inputs(preview);
  const summary = {
    instances,
    name: doc.name,
    title: doc.title,
    grid: m.grid,
    viewBox: m.viewBox,
    glyphs: Object.fromEntries(
      Object.entries(doc.glyphs ?? {}).map(([name, g]) => [
        name,
        { subpaths: inspectGlyph((g as { d: string }).d) },
      ]),
    ),
    nodes: m.nodes.flatMap((n, i) => (n.parent < 0 ? [node(i)] : [])),
    inputs: Object.fromEntries(slots),
    timelines: m.timelines.map((t) => ({
      name: t.name,
      duration: t.duration,
      loop: t.loop,
      reducedMotion: t.reduced,
      writes: t.tracks.map((x) => x.addr),
      events: t.events.map((e) => e[1]),
    })),
    layers,
    bound: [
      ...Object.keys(doc.bind ?? {}).filter((a) => a !== '$comment'),
      ...m.nodes.flatMap((n) =>
        Object.entries(n.raw.inputs ?? {})
          .filter(([, v]) => typeof v === 'string')
          .map(([key]) => n.id + '.' + key),
      ),
    ],
    overlaps: [...writers]
      .filter(([, ls]) => ls.length > 1)
      .map(([a, ls]) => `${a} is written by ${ls.join(', ')} (the last one wins)`),
    listeners: m.listeners.map(
      (l, i) =>
        `${l.on}${l.target >= 0 ? ` on ${m.nodes[l.target]!.id}` : ''} → ${[...l.fire.map((x) => `fire ${x}`), ...l.set.map(([k, v]) => `set ${k}=${v}`), ...l.toggle.map((x) => `toggle ${x}`), ...(l.emit ? [`emit ${l.emit}`] : []), ...Object.entries(doc.listeners?.[i]?.write ?? {}).map(([field, input]) => `write ${field} → ${input}`)].join(', ')}`,
    ),
    a11y: doc.a11y ?? null,
    warnings: diagnostics
      .filter((d) => d.severity === 'warning')
      .map((d) => `${d.code} ${d.pointer}: ${d.message}`),
  };
  if (json) return (io.out(JSON.stringify(summary)), 0);
  const lines: string[] = [
    `${doc.name}${doc.title ? ` — ${doc.title}` : ''} (grid ${m.grid}, viewBox ${m.viewBox.join(' ')})`,
    '',
    'glyphs (bbox: minX minY maxX maxY, grid units; hole hints use bbox containment only)',
  ];
  for (const [name, glyph] of Object.entries(summary.glyphs)) {
    lines.push(`  ${name}`);
    for (const sp of glyph.subpaths)
      lines.push(
        `    ${sp.index}: bbox ${sp.bbox.join(' ')}${sp.likelyHoleOf.length ? `; likely hole of ${sp.likelyHoleOf.join(', ')}` : ''}`,
      );
  }
  lines.push('', 'nodes');
  const tree = (
    n: {
      id: string;
      type: string;
      glyph?: string;
      subpaths?: unknown;
      pivot?: number[];
      animated?: string[];
      children?: object[];
      knockout?: number;
    },
    d: string,
  ) => {
    lines.push(
      `${d}${n.id} (${n.type}${n.glyph ? ` ${n.glyph}[${n.subpaths}]` : ''})${n.pivot ? ` pivot ${n.pivot.join(',')}` : ''}${n.animated ? ` animates ${n.animated.join(', ')}` : ''}${n.knockout !== undefined ? ` knockout ${n.knockout}` : ''}`,
    );
    for (const c of (n.children ?? []) as (typeof n)[]) tree(c, d + '  ');
  };
  for (const n of summary.nodes as Parameters<typeof tree>[0][]) tree(n, '  ');
  lines.push(
    '',
    `inputs: ${
      Object.entries(summary.inputs)
        .map(([k, v]) => `${k} (${v})`)
        .join(', ') || 'none'
    }`,
    '',
    'timelines',
  );
  for (const t of summary.timelines)
    lines.push(
      `  ${t.name}: ${t.duration}s ${t.loop}, reduced motion: ${t.reducedMotion}${t.events.length ? `, events ${t.events.join(', ')}` : ''}`,
      `    writes ${t.writes.join(', ')}`,
    );
  lines.push('', 'machine');
  for (const l of layers) {
    lines.push(`  layer ${l.name} (writes ${l.writes.join(', ') || 'nothing'})`);
    for (const s of l.states)
      lines.push(
        `    ${s.name === l.initial ? '*' : ' '}${s.name}: ${s.kind ? `${s.kind} state` : 'play' in s ? `play ${s.play}` : `pose ${JSON.stringify(s.pose)}`}${s.emit ? `, emit ${s.emit}` : ''}${'deadEnd' in s && s.kind !== 'any' ? ' (no way out)' : ''}`,
        ...s.on.map((t: string) => `        ${t}`),
      );
  }
  if (instances.length)
    lines.push('', 'instances', ...instances.map((l) => `  ${l.layer}: ${l.state}`));
  if (summary.bound.length) lines.push('', 'bound', ...summary.bound.map((a) => `  ${a}`));
  lines.push('', 'listeners', ...summary.listeners.map((l) => `  ${l}`));
  if (summary.overlaps.length) lines.push('', 'overlaps', ...summary.overlaps.map((x) => `  ${x}`));
  if (summary.warnings.length) lines.push('', 'warnings', ...summary.warnings.map((x) => `  ${x}`));
  io.out(lines.join('\n'));
  return 0;
}

// ---------------------------------------------------------------- render

async function render(
  f: string,
  o: Record<string, unknown>,
  json: boolean,
  io: IO,
  measurer: ToolMeasurer,
): Promise<number> {
  const drawFrame = (player: Player, look: Look, size?: number, id?: string) => {
    const svg = frameSVG(player, look, size, id);
    return o['browser-text'] ? embedFontCSS(svg, measurer) : outlineSVG(svg, measurer);
  };
  const rasterize = (svg: string) =>
    o['browser-text'] ? browserTextPNG(svg, measurer) : Promise.resolve(toPNG(svg));
  const out = o.out as string | undefined;
  const compare = o.compare as string | undefined;
  if ((!compare && !out && !o.probe && !o.audio) || (out && !/\.(svg|png|webm)$/.test(out)))
    throw new Usage('render needs -o <file>.svg|png|webm');
  let { model } = loaded(f, io, json);
  if (!model) return 1;
  if (o.component) {
    const definition = model.doc.components?.[String(o.component)];
    if (!definition) throw new Usage('unknown component ' + o.component);
    const doc = model.doc;
    const selected = load({
      anima: '0.1',
      requires: doc.requires,
      components: doc.components,
      ...(doc.data ? { data: doc.data } : {}),
      ...(doc.assets ? { assets: doc.assets } : {}),
      ...(doc.converters ? { converters: doc.converters } : {}),
      name: String(o.component),
      ...definition,
      ...(typeof definition.data === 'string'
        ? { data: { ...doc.data, model: definition.data } }
        : {}),
    });
    if (!selected.model) {
      report(f, selected.diagnostics, io);
      return 1;
    }
    model = selected.model;
  }
  try {
    embedAssets(model.doc, f, true);
    await imageDimensions(model.doc);
  } catch {
    const d: Located[] = [
      {
        code: 'asset-load',
        severity: 'error',
        pointer: '/assets',
        message: 'cannot read or decode image asset',
        hint: 'check the source relative to the document',
      },
    ];
    if (json) io.out(JSON.stringify({ file: f, ok: false, diagnostics: d }));
    else report(f, d, io);
    return 1;
  }
  const over: Record<string, string> = {};
  for (const c of (o.color as string[] | undefined) ?? []) {
    const [k, v] = c.split('=');
    if (!k || !v) throw new Usage('--color takes slot=value');
    over[k] = v;
  }
  const base = o.dark ? DARK : LIGHT;
  const look: Look = {
    paint: staticSlots(over),
    color: (o.current as string) ?? base.color,
    background: (o.background as string) ?? base.background,
  };
  const size = o.size ? Number(o.size) : compare ? 256 : 240;
  if (!Number.isInteger(size) || size < 1) throw new Usage('--size takes a positive integer');
  const tolerance = o.tolerance === undefined ? 0 : Number(o.tolerance);
  if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 255)
    throw new Usage('--tolerance must be an integer from 0 to 255');
  const fit = String(o.fit ?? 'contain');
  if (!['contain', 'cover', 'fill', 'none'].includes(fit))
    throw new Usage('--fit takes contain|cover|fill|none');
  if (o.viewport && !/^[1-9]\d*x[1-9]\d*$/.test(String(o.viewport)))
    throw new Usage('--viewport takes WxH positive integers');
  const [width, height] = o.viewport ? String(o.viewport).split('x').map(Number) : [size, size];
  const scale = Number(o.scale ?? 1);
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1)
    throw new Usage('--scale takes a number in (0,1]');
  if (o.sheet && (o.viewport || o.scale || o.fit))
    throw new Usage('viewport, scale and fit require a single frame');
  if (o.at !== undefined && (!Number.isFinite(Number(o.at)) || Number(o.at) < 0))
    throw new Usage('--at takes nonnegative seconds');
  const script = scriptText(o.script as string, o.eval as string) ?? '';
  const audioEvents: import('../../core/src/event-capture.ts').CapturedEvent[] = [];
  const session = createScriptSession(model, {
    ...scriptOptions(o),
    onEvents: (events) => audioEvents.push(...events),
  });
  session.execute(script);
  session.execute('advance 0'); // apply queued inputs before the first rendered frame
  if (o.at) session.execute('advance ' + Number(o.at));
  const player = session.player;
  if (compare) {
    if (o.sheet || (out && !out.endsWith('.png')))
      throw new Usage('--compare takes a single frame and optional -o diff.png');
    const result = o['browser-text']
      ? comparePNG(
          await rasterize(drawFrame(player, { paint: look.paint, color: '#000' }, size)),
          toPNG(readFileSync(compare, 'utf8'), size),
          tolerance,
          !!out,
        )
      : compareSVG(
          drawFrame(player, { paint: look.paint, color: '#000' }, size),
          readFileSync(compare, 'utf8'),
          size,
          tolerance,
          !!out,
        );
    if (out) writeFileSync(out, result.diff!);
    const { diff, ...metrics } = result;
    void diff;
    const report = { ...metrics, size, tolerance, ...(out ? { wrote: out } : {}) };
    if (json) io.out(JSON.stringify(report));
    else
      io.out(
        `${metrics.pass ? 'PASS' : 'FAIL'}: ${metrics.differingPixels} differing pixels, max channel difference ${metrics.maxChannelDifference}; ${metrics.pixelsBeyondTolerance} pixels beyond tolerance ${tolerance}${out ? `; wrote ${out}` : ''}`,
      );
    return metrics.pass ? 0 : 1;
  }
  if (o.frames !== undefined || out?.endsWith('.webm')) {
    const n = Number(o.frames ?? 60),
      fps = Number(o.fps ?? 60);
    if (
      !Number.isInteger(n) ||
      n < 1 ||
      n > 10000 ||
      !Number.isFinite(fps) ||
      fps <= 0 ||
      fps > 240 ||
      o.sheet ||
      compare ||
      !out
    )
      throw new Usage(
        'sequences need --frames 1..10000, --fps (0,240], -o file.png|file.webm; no sheet or compare',
      );
    if (!/\.(png|webm)$/.test(out)) throw new Usage('sequences output PNG or WebM');
    const images: Buffer[] = [];
    const wrote: string[] = [];
    for (let i = 0; i < n; i++) {
      if (i) session.execute('advance ' + 1 / fps);
      const svg = viewportSVG(
        drawFrame(player, look, size),
        width!,
        height!,
        fit,
        scale,
        look.background,
      );
      const png = await rasterize(svg);
      if (out.endsWith('.webm')) images.push(png);
      else {
        const path = out.replace(/\.png$/, '-' + String(i).padStart(4, '0') + '.png');
        writeFileSync(path, png);
        wrote.push(path);
      }
    }
    if (out.endsWith('.webm')) {
      const { encodeVideo } = await import('./video.ts');
      writeFileSync(out, await encodeVideo(images, fps));
      wrote.push(out);
    }
    io.out(json ? JSON.stringify({ wrote, frames: n, fps }) : 'wrote ' + wrote.join(', '));
    return 0;
  }
  let svg: string;
  if (o.sheet) {
    const n = Number(o.sheet);
    if (!Number.isInteger(n) || n < 2) throw new Usage('--sheet takes a frame count ≥ 2');
    let span = o.over ? Number(o.over) : 0;
    if (!span) {
      // Until the player settles (at most 10 s), measured on a copy.
      const probe = runScript(model, script, scriptOptions(o)).player;
      probe.step(0);
      if (o.at) probe.step(Number(o.at));
      while (span < 10) {
        span += 1 / 60;
        if (probe.step(1 / 60).settled) break;
      }
      // + 1 µs so float drift over the frame steps cannot leave the last frame just short of the end.
      span = Math.max(span, 0.5) + 1e-6;
    }
    const frames: [string, string][] = [];
    const t0 = player.time;
    for (let k = 0; k < n; k++) {
      if (k) player.step(span / (n - 1));
      frames.push([
        `t=${(player.time - t0).toFixed(3)}s`,
        drawFrame(player, look, undefined, `f${k}`),
      ]);
    }
    svg = sheetSVG(frames, look, size >= 240 ? 160 : size);
  } else svg = drawFrame(player, look, size);
  if (!o.sheet) svg = viewportSVG(svg, width!, height!, fit, scale, look.background);
  const png = out?.endsWith('.png') || o.probe ? await rasterize(svg) : undefined;
  let probes;
  if (o.probe) {
    try {
      probes = probePNG(png!, String(o.probe));
    } catch (e) {
      throw new Usage((e as Error).message);
    }
  }
  if (o.audio) writeFileSync(String(o.audio), await mixAudio(model, audioEvents, player.time, f));
  if (out) writeFileSync(out, out.endsWith('.png') ? png! : svg);
  if (o.probe) {
    io.out(JSON.stringify({ wrote: out, time: player.time, probes }));
    return 0;
  }
  if (json) io.out(JSON.stringify({ wrote: out, time: player.time, states: player.states() }));
  else io.out(`wrote ${out ?? o.audio}`);
  return 0;
}

// ---------------------------------------------------------------- new

function scaffold(rest: string[], o: Record<string, unknown>, json: boolean, io: IO): number {
  const name = rest[0];
  if (!name) throw new Usage('new needs a <name>');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || /-\d+$/.test(name))
    throw new Usage(`"${name}" must be kebab-case and not end in -<digits>`);
  if (!!o.glyph === !!o.glyphy)
    throw new Usage('new needs exactly one of --glyph <file.svg> or --glyphy <project-dir>');
  const g = o.glyph ? readGlyphSVG(o.glyph as string) : readGlyphy(o.glyphy as string, name);
  const doc = newDoc(name, g);
  const out = (o.out as string) ?? `${name}.${o.ani ? 'ani' : 'animl'}`;
  if (existsSync(out) && !o.force) {
    io.err(`${out} exists (use --force to overwrite)`);
    return 1;
  }
  const text = o.ani || out.endsWith('.ani') ? format(doc) : decompile(doc);
  if (out.endsWith('.animl') && !o.ani) {
    const c = compile(text, { file: out });
    if (c.diagnostics.length) {
      if (json) io.out(JSON.stringify({ file: out, ok: false, diagnostics: c.diagnostics }));
      else report(out, c.diagnostics, io);
      return 1;
    }
  }
  writeFileSync(out, text);
  if (json)
    io.out(
      JSON.stringify({
        wrote: out,
        glyph: o.glyph ? nameFromFile(o.glyph as string) : name,
        subpaths: (g.d.match(/[Mm]/g) ?? []).length,
      }),
    );
  else
    io.out(
      `wrote ${out} (${(g.d.match(/[Mm]/g) ?? []).length} subpaths; see them with: anima inspect ${out})`,
    );
  return 0;
}

// ---------------------------------------------------------------- schema and docs

function schema(topic: string | undefined, full: boolean, json: boolean, io: IO): number {
  if (full) return (io.out(JSON.stringify(jsonSchema(), null, 2)), 0);
  if (topic?.includes('.')) {
    const [type, ...path] = topic.split('.');
    const lines: string[] = [];
    schema(type, false, true, { out: (s) => lines.push(s), err: (s) => io.err(s) });
    const data = JSON.parse(lines[0]!);
    const key = path.join('.');
    const field = data.fields?.find(
      (f: { ani: string; markup: string }) => f.ani === key || f.markup === key,
    );
    if (!field) throw new Usage('unknown schema field ' + topic);
    io.out(JSON.stringify({ topic, ...field }));
    return 0;
  }
  const props = (
    rec: Record<
      string,
      { type: string; def?: unknown; min?: number; max?: number; feature?: string }
    >,
  ) =>
    Object.entries(rec).map(([k, p]) => ({
      name: k,
      type: p.type,
      default: p.def ?? null,
      ...(p.min !== undefined ? { min: p.min } : {}),
      ...(p.max !== undefined ? { max: p.max } : {}),
      animatable: true,
      ...(p.feature ? { feature: p.feature } : {}),
    }));
  const spellings = (t: (typeof NODE_TYPES)[number], paint?: string) =>
    nodeAttrs(t)
      .filter((a) => (!paint || a.path[0] === paint) && a.attr !== a.path.join('.'))
      .map((a) => ({ markup: a.attr, ani: a.path.join('.') }));
  const typeInfo = (t: (typeof NODE_TYPES)[number]) => ({
    type: t,
    fields: fields([], nodeShape(t)),
    spellings: spellings(t),
    animatable: props({ ...COMMON, ...OWN[t] } as never),
    static: [
      'id',
      'type',
      'pivot',
      ...Object.keys(STATIC[t]),
      ...(PAINTED.includes(t) ? ['fill', 'stroke', 'knockout'] : []),
    ],
  });
  const objectPaths: Record<string, string[]> = {
    fill: [],
    stroke: [],
    anima: [],
    meta: ['meta'],
    color: ['colors', '*'],
    glyph: ['glyphs', '*'],
    hit: ['hit'],
    timeline: ['timelines', '*'],
    track: ['timelines', '*', 'tracks'],
    event: ['timelines', '*', 'events', '*'],
    layer: ['machine', 'layers', '*'],
    state: ['machine', 'layers', '*', 'states', '*'],
    pose: ['machine', 'layers', '*', 'states', '*', 'pose'],
    ease: ['machine', 'layers', '*', 'states', '*', 'on', '*', 'ease'],
    on: ['machine', 'layers', '*', 'states', '*', 'on', '*'],
    bool: ['inputs', '*'],
    number: ['inputs', '*'],
    trigger: ['inputs', '*'],
    transition: ['machine', 'layers', '*', 'states', '*', 'on', '*'],
    listener: ['listeners', '*'],
    input: ['inputs', '*'],
  };
  const fields = (path: string[], root: Shape = DOC) => {
    let shape = root;
    for (const key of path) {
      if (shape.k === 'obj') shape = shape.p[key]!;
      else if (shape.k === 'map' || shape.k === 'arr') shape = shape.of;
      else throw new Error('invalid schema registry path');
    }
    // Maps (poses/tracks), tuples (events) and scalar declarations are registry shapes too.
    if (shape.k !== 'obj') {
      const p =
        shape.k === 'map'
          ? { '<address>': shape.of }
          : shape.k === 'tup'
            ? Object.fromEntries(shape.of.map((s, i) => [i === 0 ? 'at' : 'name', s]))
            : { [topic === 'ease' ? 'curve' : 'value']: shape };
      shape = { k: 'obj', p };
    }
    const describe = (s: Shape): string => {
      switch (s.k) {
        case 'str':
          return s.of ? s.of.map((v) => JSON.stringify(v)).join(' | ') : 'string';
        case 'num':
          return 'number';
        case 'bool':
          return 'bool';
        case 'alt':
          return s.of.map(describe).join(' | ');
        case 'arr':
          return `array<${describe(s.of)}>`;
        case 'map':
          return `map<${describe(s.of)}>`;
        case 'tup':
          return `[${s.of.map(describe).join(', ')}]`;
        default:
          return s.k;
      }
    };
    return Object.entries(shape.p).map(([key, value]) => ({
      markup: markupName(value, key),
      ani: key,
      type: describe(value),
      required: shape.req?.includes(key) ?? false,
      ...(value.default !== undefined ? { default: value.default } : {}),
      ...((value.feature ?? shape.feature) ? { feature: value.feature ?? shape.feature } : {}),
      ...(value.description ? { description: value.description } : {}),
      ...(value.k === 'num' && value.min !== undefined ? { min: value.min } : {}),
    }));
  };
  const nodeField =
    topic && (nodeShape('path').p[topic] ?? (DOC as Extract<typeof DOC, { k: 'obj' }>).p[topic]);
  const compositeField =
    nodeField &&
    (nodeField.k === 'arr' ? { ...nodeField.of, feature: nodeField.feature } : nodeField);
  const objectFields =
    topic && Object.hasOwn(objectPaths, topic)
      ? fields(
          objectPaths[topic]!,
          topic === 'fill' || topic === 'stroke' ? nodeShape('path').p[topic]! : DOC,
        )
      : topic && ELEMENTS[topic]
        ? fields([], ELEMENTS[topic]!.shape)
        : compositeField && compositeField.k === 'obj' && !NODE_TYPES.includes(topic as never)
          ? fields([], compositeField)
          : undefined;
  let data: unknown;
  if (topic === 'a11y')
    data = {
      topic,
      scope: 'node.a11y',
      fields: fields([], nodeShape('path').p.a11y),
      actions: ['tap', 'increase', 'decrease', 'focus'],
      root: { scope: 'doc.a11y (root icon semantics)', fields: fields(['a11y']) },
    };
  else if (objectFields)
    data = {
      topic,
      fields: objectFields,
      ...(topic === 'fill' || topic === 'stroke'
        ? {
            [topic]: props(PAINT[topic] as never),
            spellings: spellings('path', topic),
            static: objectFields.filter((f) => !(f.ani in PAINT[topic])).map((f) => f.ani),
          }
        : {}),
    };
  else if (!topic)
    data = {
      nodeTypes: NODE_TYPES.map(typeInfo),
      paint: { fill: props(PAINT.fill as never), stroke: props(PAINT.stroke as never) },
      paintFields: {
        fill: fields([], nodeShape('path').p.fill),
        stroke: fields([], nodeShape('path').p.stroke),
      },
    };
  else if ((NODE_TYPES as readonly string[]).includes(topic))
    data = typeInfo(topic as (typeof NODE_TYPES)[number]);
  else if (topic === 'fill' || topic === 'stroke')
    data = {
      [topic]: props(PAINT[topic] as never),
      spellings: spellings('path', topic),
      static: topic === 'fill' ? ['rule'] : ['cap', 'join'],
    };
  else
    throw new Usage(
      `no schema topic "${topic}" (try a node type, fill, stroke, a11y, timeline, layer, state, pose, transition, listener or input)`,
    );
  if (json) return (io.out(JSON.stringify(data)), 0);
  const table = (
    rows: {
      name: string;
      type: string;
      default: unknown;
      min?: number;
      max?: number;
      feature?: string;
    }[],
  ) =>
    rows
      .map(
        (r) =>
          `  ${r.name.padEnd(12)} ${r.type.padEnd(7)} default ${JSON.stringify(r.default)}${r.min !== undefined || r.max !== undefined ? `  range [${r.min ?? '-∞'}, ${r.max ?? '∞'}]` : ''}${r.feature ? ` [${r.feature}]` : ''}`,
      )
      .join('\n');
  const mapping = (rows: { markup: string; ani: string }[]) =>
    rows.map((r) => `  ${r.markup} ↔ ${r.ani}`).join('\n');
  const show = (d: ReturnType<typeof typeInfo>) =>
    `${d.type}\n animatable (address: <id>.<property>)\n${table(d.animatable)}\n not animatable: ${d.static.join(', ')}\n markup ↔ .ani\n${mapping(d.spellings)}\n module fields\n${d.fields
      .filter((f) => f.feature)
      .map((f) => '  ' + f.ani + ' [' + f.feature + ']')
      .join('\n')}`;
  const paint = (k: 'fill' | 'stroke') =>
    `${k} (address: <id>.${k}.<field>)\n${table(props(PAINT[k] as never))}\n markup ↔ .ani\n${mapping(spellings('path', k))}\n module fields\n${fields(
      [],
      nodeShape('path').p[k],
    )
      .filter((f) => f.feature)
      .map((f) => `  ${f.markup} ↔ ${k}.${f.ani}: ${f.type} [${f.feature}]`)
      .join('\n')}`;
  if (topic === 'a11y') {
    const showFields = (rows: ReturnType<typeof fields>) =>
      rows.map((f) => `  ${f.markup} ↔ ${f.ani}: ${f.type}`).join('\n');
    io.out(
      `node.a11y (node semantics; markup ↔ .ani: type)\n${showFields(fields([], nodeShape('path').p.a11y))}\nActions: tap, increase, decrease, focus\n\ndoc.a11y (root icon semantics; markup ↔ .ani: type)\n${showFields(fields(['a11y']))}`,
    );
  } else if (objectFields)
    io.out(
      `${topic} (markup ↔ .ani: type)\n${objectFields.map((f) => `  ${f.markup} ↔ ${topic === 'fill' || topic === 'stroke' ? topic + '.' : ''}${f.ani}: ${f.type}${f.required ? ' (required)' : ''}${'default' in f ? ` (default ${JSON.stringify(f.default)})` : ''}${f.feature ? ` [${f.feature}]` : ''}${f.description ? ` — ${f.description}` : ''}`).join('\n')}`,
    );
  else if (!topic)
    io.out([...NODE_TYPES.map(typeInfo).map(show), paint('fill'), paint('stroke')].join('\n\n'));
  else if (topic === 'fill' || topic === 'stroke') io.out(paint(topic));
  else io.out(show(data as ReturnType<typeof typeInfo>));
  return 0;
}

function docs(
  topic: string | undefined,
  list: boolean,
  json: boolean,
  io: IO,
  section?: string,
): number {
  const read = (p: string) => readFileSync(new URL(p, ROOT), 'utf8');
  const guide = read('docs/AUTHORING.md');
  const sections = [...guide.matchAll(/^## (.+)$/gm)].map((m) => ({
    title: m[1]!,
    slug: m[1]!
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
    at: m.index!,
  }));
  const spec = read('spec/SPEC.md');
  const chapters = [...spec.matchAll(/^## (.+)$/gm)];
  // Module chapters are the one-word lower-case headings (`## paint`); web-only modules such as
  // `canvas` have a chapter but nothing registered in core.
  const moduleTopics = chapters.filter((m) => /^[a-z]+(?:-[a-z]+)*$/.test(m[1]!));
  const moduleDocs = new Map(
    readdirSync(new URL('modules/', ROOT), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map(
        (entry) =>
          [
            entry.name,
            ['AUTHORING.md', 'SPEC.md']
              .map((file) => `modules/${entry.name}/${file}`)
              .filter((file) => existsSync(new URL(file, ROOT))),
          ] as const,
      )
      .filter(([, files]) => files.length),
  );
  if ((topic === 'spec' && (list || section)) || (topic === 'authoring' && section)) {
    const source = topic === 'spec' ? spec : guide;
    const entries = [...source.matchAll(/^#{2,3} (.+)$/gm)].map((m) => ({
      title: m[1]!,
      slug: m[1]!
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      at: m.index!,
    }));
    if (list)
      return (
        io.out(
          json
            ? JSON.stringify(entries.map(({ title, slug }) => ({ title, slug })))
            : entries.map((e) => e.slug + '\t' + e.title).join('\n'),
        ),
        0
      );
    const i = entries.findIndex((e) => e.slug === section);
    if (i < 0) throw new Usage('unknown docs section ' + section);
    const text = source.slice(entries[i]!.at, entries[i + 1]?.at ?? source.length).trim();
    return (io.out(json ? JSON.stringify({ topic, section, text }) : text), 0);
  }
  if (list) {
    const topics = [
      ...new Set([
        'authoring',
        'spec',
        ...sections.map((s) => s.slug),
        'markup',
        ...moduleTopics.map((m) => m[1]!),
        ...moduleDocs.keys(),
      ]),
    ];
    return (io.out(json ? JSON.stringify(topics) : topics.join('\n')), 0);
  }
  let text: string;
  if (!topic || topic === 'authoring')
    text =
      guide.split('\n')[0] +
      '\n\nContents (anima docs authoring <section>):\n' +
      sections.map((s) => '- ' + s.slug + ': ' + s.title).join('\n') +
      '\n\n' +
      guide;
  else if (topic === 'spec') text = spec;
  else if (topic === 'markup') text = read('spec/ANIML.md');
  else if (moduleDocs.has(topic) || moduleTopics.some((m) => m[1] === topic)) {
    const i = chapters.findIndex((m) => m[1] === topic);
    text =
      i < 0 ? '' : spec.slice(chapters[i]!.index, chapters[i + 1]?.index ?? spec.length).trim();
    for (const file of moduleDocs.get(topic) ?? [])
      text += '\n\n' + (i < 0 ? read(file).trim() : read(file).trim().replace(/^#/gm, '###'));
    const examples = new URL(`modules/${topic}/examples/`, ROOT);
    if (existsSync(examples))
      text +=
        '\n\nExamples (AniML sources with built .ani siblings):\n' +
        readdirSync(examples)
          .filter((f) => f.endsWith('.animl'))
          .sort()
          .map((f) => `- modules/${topic}/examples/${f}`)
          .join('\n');
  } else {
    const i = sections.findIndex((s) => s.slug === topic || s.slug.startsWith(topic));
    if (i < 0) throw new Usage(`no docs topic "${topic}" (anima docs --list)`);
    text = guide.slice(sections[i]!.at, sections[i + 1]?.at ?? guide.length).trim();
  }
  io.out(json ? JSON.stringify({ topic: topic ?? 'authoring', text }) : text);
  return 0;
}

async function build(
  f: string,
  out: string | undefined,
  json: boolean,
  io: IO,
  embed = false,
): Promise<number> {
  const source = f.endsWith('.animl') ? projectSource(f) : readFileSync(f, 'utf8');
  let text: string | undefined;
  let diagnostics: MarkupDiagnostic[];
  let sourceMap: import('@anima-format/markup').CompileResult['map'] | undefined;
  if (/\.html?$/i.test(f)) ({ text, diagnostics } = buildHTML(source, f));
  else if (f.endsWith('.animl'))
    ({
      text,
      diagnostics,
      map: sourceMap,
    } = compile(source, {
      file: f,
      resolve: (path) => substituteConstants(readFileSync(path, 'utf8'), findProject()?.constants),
    }));
  else throw new Usage('build needs a .animl or .html file');
  if (text !== undefined) {
    const docs: import('./build-assets.ts').AssetDocument[] = [];
    const maps: (typeof sourceMap)[] = [];
    if (/\.html?$/i.test(f))
      buildHTML(source, f, (doc, map) => {
        docs.push(doc);
        maps.push(map);
      });
    else {
      docs.push(JSON.parse(text));
      maps.push(sourceMap);
    }
    const encoder = new ImageEncoder();
    try {
      for (const [i, doc] of docs.entries())
        diagnostics.push(
          ...(await buildAssets(
            doc,
            f,
            embed,
            encoder,
            (pointer) => maps[i]?.get(pointer)?.file ?? f,
          )),
        );
    } finally {
      await encoder.close();
    }
    if (diagnostics.some((d) => d.severity === 'error')) text = undefined;
    else if (/\.html?$/i.test(f)) {
      let i = 0;
      ({ text } = buildHTML(source, f, (doc) => Object.assign(doc, docs[i++])));
    } else text = format(docs[0]);
  }
  if (json && (text === undefined || out))
    io.out(
      JSON.stringify({
        file: f,
        ok: text !== undefined,
        diagnostics,
        ...(text !== undefined && out ? { wrote: out } : {}),
      }),
    );
  else if (json && diagnostics.length) io.err(JSON.stringify({ file: f, diagnostics }));
  else report(f, diagnostics, io);
  if (text === undefined) return 1;
  if (out) writeFileSync(out, text);
  else if (io.write) io.write(text);
  else io.out(text);
  return 0;
}

function schemaSearch(words: string, json: boolean, io: IO): number {
  if (!words.trim()) throw new Usage('--search needs at least one word');
  const topics = [
    ...new Set([
      ...NODE_TYPES,
      ...Object.keys(ELEMENTS),
      'fill',
      'stroke',
      'anima',
      'a11y',
      'timeline',
      'layer',
      'state',
      'transition',
      'listener',
      'input',
    ]),
  ];
  const entries: { name: string; description: string; kind: string }[] = [];
  for (const topic of topics) {
    const lines: string[] = [];
    try {
      schema(topic, false, true, { out: (s) => lines.push(s), err: () => {} });
    } catch {
      continue;
    }
    const data = JSON.parse(lines[0]!);
    entries.push({ name: topic, description: 'registry type ' + topic, kind: 'type' });
    for (const f of data.fields ?? []) {
      if (f.markup !== f.ani)
        entries.push({
          name: topic + '.' + f.markup,
          description: [f.description, f.type, f.ani].filter(Boolean).join(' '),
          kind: 'field',
        });
      entries.push({
        name: topic + '.' + f.ani,
        description: [f.description, f.type, f.markup].filter(Boolean).join(' '),
        kind: 'field',
      });
    }
  }
  const spec = readFileSync(new URL('spec/SPEC.md', ROOT), 'utf8');
  for (const match of spec.matchAll(/^\| `([^`]+)` \| (?:error|warning) \| (.+) \|$/gm))
    entries.push({ name: match[1]!, description: match[2]!, kind: 'diagnostic' });
  const terms = words.toLowerCase().trim().split(/\s+/);
  const results = entries
    .map((e) => ({
      ...e,
      score: terms.reduce(
        (s, t) =>
          s +
          (e.name.toLowerCase() === t
            ? 100
            : e.name.toLowerCase().includes(t)
              ? 10
              : e.description.toLowerCase().includes(t)
                ? 1
                : 0),
        0,
      ),
    }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (json) io.out(JSON.stringify({ results }));
  else io.out(results.map((e) => `${e.name}\t${e.kind}\t${e.description}`).join('\n'));
  return 0;
}

function sampleProject(rest: string[], o: Record<string, unknown>, json: boolean, io: IO): number {
  const sample = String(o.sample),
    target = (o.out as string | undefined) ?? rest[0];
  if (!['bell', 'moon', 'progress'].includes(sample))
    throw new Usage('--sample takes bell|moon|progress');
  if (!target) throw new Usage('new --sample needs a destination directory');
  if (existsSync(target)) {
    io.err('sample destination already exists; choose a new directory');
    return 1;
  }
  mkdirSync(target, { recursive: true });
  cpSync(new URL(`examples/${sample}.animl`, ROOT), resolve(target, 'main.animl'));
  cpSync(new URL('examples/lib', ROOT), resolve(target, 'lib'), { recursive: true });
  writeFileSync(
    resolve(target, 'anima.json'),
    JSON.stringify(
      { entry: 'main.animl', out: 'dist', presets: { preview: { size: 240 } } },
      null,
      2,
    ) + '\n',
  );
  writeFileSync(
    resolve(target, 'AGENTS.md'),
    '# Animation project\n\nRun `anima validate`, `anima render --preset preview -o preview.png`, and `anima build`.\nEdit main.animl; anima.json defines project defaults.\n',
  );
  if (json) io.out(JSON.stringify({ wrote: target, sample }));
  else io.out(`created ${target}`);
  return 0;
}

async function exportProject(file: string, dir: string, json: boolean, io: IO): Promise<number> {
  const checked = loaded(file, io, json);
  if (!checked.model) return 1;
  let doc = structuredClone(checked.model.doc);
  if (file.endsWith('.animl')) {
    let compiled = '';
    const result = await build(
      file,
      undefined,
      false,
      {
        out: (s) => {
          compiled += s;
        },
        write: (s) => {
          compiled += s;
        },
        err: (s) => io.err(s),
      },
      true,
    );
    if (result) return result;
    doc = JSON.parse(compiled);
  } else embedAssets(doc, file);
  const { build: bundleRuntime } = await import('esbuild');
  const runtime = await bundleRuntime({
    entryPoints: [new URL('../../web/src/all-modules.ts', import.meta.url).pathname],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    write: false,
    minify: true,
  });
  mkdirSync(dir, { recursive: true });
  const name = basename(file).replace(/\.(animl|ani)$/, '') + '.ani';
  writeFileSync(resolve(dir, name), format(doc));
  writeFileSync(resolve(dir, 'anima.js'), runtime.outputFiles[0]!.text);
  writeFileSync(
    resolve(dir, 'index.html'),
    `<!doctype html>\n<html lang="en"><meta charset="utf-8"><title>Anima export</title><script type="module" src="./anima.js"></script><anima-icon style="width:240px;height:240px"><script type="application/vnd.anima+json">${format(doc).replaceAll('<', '\\u003c')}</script></anima-icon></html>\n`,
  );
  if (json) io.out(JSON.stringify({ wrote: dir, files: [name, 'anima.js', 'index.html'] }));
  else io.out('wrote ' + dir);
  return 0;
}

function filteredSchema(
  topic: string | undefined,
  options: Record<string, unknown>,
  json: boolean,
  io: IO,
): number {
  if (options['editor-only']) {
    const result = { applicable: false, reason: 'Anima has no editor-only entries', fields: [] };
    io.out(json ? JSON.stringify(result) : result.reason);
    return 0;
  }
  const lines: string[] = [];
  schema(topic, false, true, { out: (s) => lines.push(s), err: (s) => io.err(s) });
  type Row = {
    ani: string;
    name?: string;
    animatable: boolean;
    bindable: boolean;
    inherited: boolean;
    type: string;
  };
  const data = JSON.parse(lines[0]!);
  const nodeRows = (
    t: (typeof NODE_TYPES)[number],
    info: { fields: { ani: string; type: string }[] },
  ) =>
    info.fields.map((f) => {
      const prop = COMMON[f.ani] ?? OWN[t][f.ani];
      return {
        ...f,
        animatable: !!prop,
        bindable: !!prop,
        inherited: Object.hasOwn(COMMON, f.ani),
      };
    });
  let rows: Row[];
  if (!topic)
    rows = data.nodeTypes.flatMap(
      (info: { type: (typeof NODE_TYPES)[number]; fields: { ani: string; type: string }[] }) =>
        nodeRows(info.type, info).map((f) => ({ ...f, ani: info.type + '.' + f.ani })),
    );
  else if (NODE_TYPES.includes(topic as never)) rows = nodeRows(topic as never, data);
  else {
    const [type, key] = topic.split('.');
    if (key && NODE_TYPES.includes(type as never))
      rows = nodeRows(type as never, { fields: [data] });
    else
      rows = (data.fields ?? []).map((f: Row) => ({
        ...f,
        animatable: !!PAINT[topic as 'fill']?.[f.ani],
        bindable: !!PAINT[topic as 'fill']?.[f.ani],
        inherited: false,
      }));
  }
  const fields = rows.filter(
    (f) =>
      (!options.animatable || f.animatable) &&
      (!options.bindable || f.bindable) &&
      (!options.inherited || f.inherited),
  );
  io.out(
    json
      ? JSON.stringify({ topic, fields })
      : fields
          .map(
            (f) =>
              `${f.ani}: ${f.type}; animatable=${f.animatable} bindable=${f.bindable} inherited=${f.inherited}`,
          )
          .join('\n'),
  );
  return 0;
}
