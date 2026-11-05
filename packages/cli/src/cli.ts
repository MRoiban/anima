import '@anima-format/core/all';
// The `anima` command line (ARCHITECTURE §cli). Every command takes --format=json; exit codes are
// 0 ok, 1 diagnostics or a failed check, 2 usage.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
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
import { startPlayground } from './playground.ts';
import { inspectGlyph } from './glyphs.ts';
import { embedAssets, imageDimensions } from './assets.ts';
import { buildHTML } from './html.ts';
import { lineCol, locate, syntaxErrorAt } from './locate.ts';
import { DARK, LIGHT, type Look, compareSVG, frameSVG, sheetSVG, toPNG } from './render.ts';
import { nameFromFile, newDoc, readGlyphSVG, readGlyphy, sha256 } from './scaffold.ts';

export interface IO {
  out(s: string): void;
  err(s: string): void;
  /** Exact stdout bytes for compiled artifacts (out is line-oriented). */
  write?(s: string): void;
}

class Usage extends Error {}

const ROOT = new URL('../../../', import.meta.url);

const HELP = `anima — check, see and scaffold .animl and .ani animations

  anima playground [file.animl] [--port 4519]  local live editor (built-in bell is read-only)
  anima validate <file>                 all diagnostics, with JSON pointers, lines and hints
  anima inspect <file>                  nodes, glyph subpaths and bounds, timelines, state graph
  anima sample <file> [-s script | -e "cmds"] [--reduced-motion]
                                        run a script (spec §11.2), print snapshots as JSON lines
  anima render <file> -o out.svg|png [--at t] [-s script | -e "cmds"] [--size px]
               [--sheet N [--over seconds]] [--dark] [--color slot=#hex] [--current #hex]
               [--background #hex]       draw a frame or a labelled contact sheet
  anima render <file> --compare glyph.svg [--at t] [-s script | -e "cmds"]
               [--size px] [--tolerance 0..255] [-o diff.png]
                                        compare RGBA pixels (default 256px, black currentColor,
                                        transparent background); exit 1 beyond tolerance (default 0)
  anima fmt <file> [--write | --check]  canonical formatting
  anima new <name> --glyph <file.svg> | --glyphy <project-dir> [-o out.animl] [--ani] [--force]
                                        scaffold AniML whose rest frame is the glyph (--ani for JSON)
  anima build <file.animl|page.html> [-o out] [--embed]  compile AniML to canonical .ani or inline JSON
  anima decompile <file.ani> [-o out.animl]    write canonical AniML
  anima schema [type | fill | stroke | a11y | timeline | layer | state | pose | transition | listener | input] [--json-schema]
                                        registry fields, types and markup/.ani spellings
  anima docs [authoring | spec | markup | <section>] [--list]
                                        the authoring guide and the spec

Authoring commands accept .animl and .ani. Every command takes --format=json. Exit codes: 0 ok, 1 diagnostics, 2 usage.`;

export async function run(argv: string[], io: IO): Promise<number> {
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        port: { type: 'string' },
        format: { type: 'string', default: 'text' },
        script: { type: 'string', short: 's' },
        eval: { type: 'string', short: 'e' },
        'reduced-motion': { type: 'boolean' },
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
    switch (cmd) {
      case 'playground': {
        if (rest.length > 1) throw new Usage('playground takes at most one .animl file');
        const port = o.port === undefined ? 4519 : Number(o.port);
        if (!Number.isInteger(port) || port < 0 || port > 65535)
          throw new Usage('--port takes an integer from 0 to 65535');
        const host = await startPlayground({ file: rest[0], port });
        if (json) emit({ url: host.url, writable: !!rest[0] });
        else io.out(`Anima Playground: ${host.url}${rest[0] ? '' : ' (example is read-only)'}`);
        return 0;
      }
      case 'validate':
        return validate(file(rest), json, io);
      case 'inspect':
        return inspect(file(rest), json, io);
      case 'sample': {
        const { model } = loaded(file(rest), io, json);
        if (!model) return 1;
        const script = scriptText(o.script, o.eval) ?? 'snapshot';
        const { snapshots } = runScript(model, script, { reducedMotion: o['reduced-motion'] });
        for (const s of snapshots) io.out(JSON.stringify(s));
        return 0;
      }
      case 'render':
        return render(file(rest), o, json, io);
      case 'build':
        return build(file(rest), o.out, json, io, o.embed);
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
        return scaffold(rest, o, json, io);
      case 'schema':
        return schema(rest[0], !!o['json-schema'], json, io);
      case 'docs':
        return docs(rest[0], !!o.list, json, io);
      default:
        throw new Usage(`unknown command "${cmd}"`);
    }
  } catch (e) {
    if (e instanceof Usage) {
      io.err(`${e.message}\n\n${HELP}`);
      return 2;
    }
    if (e instanceof ScriptError) {
      io.err(`script ${e.message}`);
      return 1;
    }
    io.err((e as Error).message);
    return 1;
  }
}

function file(rest: string[]): string {
  const f = rest[0];
  if (!f) throw new Usage('missing <file>');
  if (!existsSync(f)) throw new Usage(`no such file: ${f}`);
  return f;
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
function check(f: string): { model?: Model; diagnostics: Located[]; text: string } {
  const text = readFileSync(f, 'utf8');
  if (f.endsWith('.animl')) {
    const c = compile(text, { file: f, resolve: (path) => readFileSync(path, 'utf8') });
    const diagnostics = [...c.diagnostics];
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
  const diagnostics: Located[] = [...r.diagnostics];
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

function validate(f: string, json: boolean, io: IO): number {
  const { model, diagnostics } = check(f);
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

function inspect(f: string, json: boolean, io: IO): number {
  const { model, diagnostics } = loaded(f, io, json);
  if (!model) return 1;
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
        ...(s.on.length ? {} : { deadEnd: true }),
      })),
    };
  });
  const summary = {
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
    inputs: Object.fromEntries([...m.inputs.values()].map((i) => [i.name, i.type])),
    timelines: m.timelines.map((t) => ({
      name: t.name,
      duration: t.duration,
      loop: t.loop,
      reducedMotion: t.reduced,
      writes: t.tracks.map((x) => x.addr),
      events: t.events.map((e) => e[1]),
    })),
    layers,
    bound: Object.keys(doc.bind ?? {}).filter((a) => a !== '$comment'),
    overlaps: [...writers]
      .filter(([, ls]) => ls.length > 1)
      .map(([a, ls]) => `${a} is written by ${ls.join(', ')} (the last one wins)`),
    listeners: m.listeners.map(
      (l) =>
        `${l.on}${l.target >= 0 ? ` on ${m.nodes[l.target]!.id}` : ''} → ${[...l.fire.map((x) => `fire ${x}`), ...l.set.map(([k, v]) => `set ${k}=${v}`), ...l.toggle.map((x) => `toggle ${x}`), ...(l.emit ? [`emit ${l.emit}`] : [])].join(', ')}`,
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
        `    ${s.name === l.initial ? '*' : ' '}${s.name}: ${'play' in s ? `play ${s.play}` : `pose ${JSON.stringify(s.pose)}`}${s.emit ? `, emit ${s.emit}` : ''}${s.on.length ? '' : ' (no way out)'}`,
        ...s.on.map((t: string) => `        ${t}`),
      );
  }
  if (summary.bound.length) lines.push('', 'bound', ...summary.bound.map((a) => `  ${a}`));
  lines.push('', 'listeners', ...summary.listeners.map((l) => `  ${l}`));
  if (summary.overlaps.length) lines.push('', 'overlaps', ...summary.overlaps.map((x) => `  ${x}`));
  if (summary.warnings.length) lines.push('', 'warnings', ...summary.warnings.map((x) => `  ${x}`));
  io.out(lines.join('\n'));
  return 0;
}

// ---------------------------------------------------------------- render

function render(f: string, o: Record<string, unknown>, json: boolean, io: IO): number {
  const out = o.out as string | undefined;
  const compare = o.compare as string | undefined;
  if ((!compare && !out) || (out && !/\.(svg|png)$/.test(out)))
    throw new Usage('render needs -o <file>.svg or <file>.png');
  const { model } = loaded(f, io, json);
  if (!model) return 1;
  try {
    embedAssets(model.doc, f, true);
    imageDimensions(model.doc);
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
  const script = scriptText(o.script as string, o.eval as string) ?? '';
  const { player } = runScript(model, script, { reducedMotion: !!o['reduced-motion'] });
  player.step(0); // apply inputs the script queued, so frame 0 shows them
  if (o.at) player.step(Number(o.at));
  if (compare) {
    if (o.sheet || (out && !out.endsWith('.png')))
      throw new Usage('--compare takes a single frame and optional -o diff.png');
    const result = compareSVG(
      frameSVG(player, { paint: look.paint, color: '#000' }, size),
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
  let svg: string;
  if (o.sheet) {
    const n = Number(o.sheet);
    if (!Number.isInteger(n) || n < 2) throw new Usage('--sheet takes a frame count ≥ 2');
    let span = o.over ? Number(o.over) : 0;
    if (!span) {
      // Until the player settles (at most 10 s), measured on a copy.
      const probe = runScript(model, script, { reducedMotion: !!o['reduced-motion'] }).player;
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
        frameSVG(player, look, undefined, `f${k}`),
      ]);
    }
    svg = sheetSVG(frames, look, size >= 240 ? 160 : size);
  } else svg = frameSVG(player, look, size);
  writeFileSync(out!, out!.endsWith('.png') ? toPNG(svg) : svg);
  if (json) io.out(JSON.stringify({ wrote: out, time: player.time, states: player.states() }));
  else io.out(`wrote ${out}`);
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
    a11y: ['a11y'],
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
      ...(value.k === 'num' && value.min !== undefined ? { min: value.min } : {}),
    }));
  };
  const nodeField = topic && nodeShape('path').p[topic];
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
  if (objectFields)
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
  if (objectFields)
    io.out(
      `${topic} (markup ↔ .ani: type)\n${objectFields.map((f) => `  ${f.markup} ↔ ${topic === 'fill' || topic === 'stroke' ? topic + '.' : ''}${f.ani}: ${f.type}${f.required ? ' (required)' : ''}${'default' in f ? ` (default ${JSON.stringify(f.default)})` : ''}${f.feature ? ` [${f.feature}]` : ''}`).join('\n')}`,
    );
  else if (!topic)
    io.out([...NODE_TYPES.map(typeInfo).map(show), paint('fill'), paint('stroke')].join('\n\n'));
  else if (topic === 'fill' || topic === 'stroke') io.out(paint(topic));
  else io.out(show(data as ReturnType<typeof typeInfo>));
  return 0;
}

function docs(topic: string | undefined, list: boolean, json: boolean, io: IO): number {
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
  if (list) {
    const topics = ['authoring', 'spec', ...sections.map((s) => s.slug), 'markup'];
    return (io.out(json ? JSON.stringify(topics) : topics.join('\n')), 0);
  }
  let text: string;
  if (!topic || topic === 'authoring') text = guide;
  else if (topic === 'spec') text = read('spec/SPEC.md');
  else if (topic === 'markup') text = read('spec/ANIML.md');
  else {
    const i = sections.findIndex((s) => s.slug === topic || s.slug.startsWith(topic));
    if (i < 0) throw new Usage(`no docs topic "${topic}" (anima docs --list)`);
    text = guide.slice(sections[i]!.at, sections[i + 1]?.at ?? guide.length).trim();
  }
  io.out(json ? JSON.stringify({ topic: topic ?? 'authoring', text }) : text);
  return 0;
}

function build(f: string, out: string | undefined, json: boolean, io: IO, embed = false): number {
  const source = readFileSync(f, 'utf8');
  let text: string | undefined;
  let diagnostics: MarkupDiagnostic[];
  if (/\.html?$/i.test(f)) ({ text, diagnostics } = buildHTML(source, f));
  else if (f.endsWith('.animl'))
    ({ text, diagnostics } = compile(source, {
      file: f,
      resolve: (path) => readFileSync(path, 'utf8'),
    }));
  else throw new Usage('build needs a .animl or .html file');
  if (text !== undefined && embed) {
    try {
      if (/\.html?$/i.test(f))
        ({ text, diagnostics } = buildHTML(source, f, (doc) => embedAssets(doc, f)));
      else {
        const doc = JSON.parse(text);
        embedAssets(doc, f);
        text = format(doc);
      }
    } catch {
      text = undefined;
      diagnostics.push({
        code: 'asset-load',
        severity: 'error',
        pointer: '/assets',
        message: 'cannot read referenced asset',
        hint: 'check asset sources relative to the document',
      });
    }
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
