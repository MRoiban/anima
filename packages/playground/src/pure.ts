// seam(P8-5): preserve mesh point tuples alongside existing scalar/colour values.
import {
  formatHex,
  sampleTrack,
  type Model,
  type Player,
  type LayerM,
  type TimelineM,
} from '@anima-format/core';
import type { MarkupDiagnostic } from '@anima-format/markup';

export const escapeHTML = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 1-based compiler position → clamped textarea selection, also for CRLF and incomplete lines. */
export function diagnosticRange(
  source: string,
  d: Pick<MarkupDiagnostic, 'line' | 'column'>,
): [number, number] {
  const lines = source.split('\n');
  const line = Math.max(0, Math.min(lines.length - 1, (d.line ?? 1) - 1));
  const start =
    lines.slice(0, line).reduce((n, s) => n + s.length + 1, 0) +
    Math.min(lines[line]!.length, Math.max(0, (d.column ?? 1) - 1));
  const token = /^[\w.:-]+/.exec(source.slice(start))?.[0] ?? '';
  return [start, Math.min(source.length, start + Math.max(1, token.length))];
}

/** One token pass on raw source: never interpret source text or re-highlight generated spans. */
export function highlight(source: string, diagnostics: MarkupDiagnostic[] = []): string {
  const tokens = /<!--[\s\S]*?(?:-->|$)|(<\/?)([\w-]+)|([\w.:-]+)(\s*=\s*)("[^"]*"|'[^']*')/g;
  const ranges = diagnostics.map((d) => diagnosticRange(source, d));
  let at = 0;
  let out = '';
  function emit(s: string, start: number, cls = ''): string {
    return s
      .split('\n')
      .map((line, i, ls) => {
        const offset = start;
        start += line.length + (i < ls.length - 1 ? 1 : 0);
        const cuts = new Set([0, line.length]);
        for (const [a, b] of ranges)
          if (a < offset + line.length && b > offset) {
            cuts.add(Math.max(0, a - offset));
            cuts.add(Math.min(line.length, b - offset));
          }
        const edges = [...cuts].sort((a, b) => a - b);
        let h = '';
        for (let j = 1; j < edges.length; j++) {
          const a = edges[j - 1]!,
            b = edges[j]!;
          const squig = ranges.some(([x, y]) => x < offset + b && y > offset + a);
          const c = [cls, squig ? 'squig' : ''].filter(Boolean).join(' ');
          h += c
            ? `<span class="${c}">${escapeHTML(line.slice(a, b))}</span>`
            : escapeHTML(line.slice(a, b));
        }
        return h;
      })
      .join('\n');
  }
  for (const m of source.matchAll(tokens)) {
    out += emit(source.slice(at, m.index), at);
    if (m[0].startsWith('<!--')) out += emit(m[0], m.index, 'c');
    else if (m[2]) out += emit(m[1]!, m.index) + emit(m[2], m.index + m[1]!.length, 't');
    else
      out +=
        emit(m[3]!, m.index, 'a') +
        emit(m[4]!, m.index + m[3]!.length) +
        emit(m[5]!, m.index + m[3]!.length + m[4]!.length, 'v');
    at = m.index + m[0].length;
  }
  out += emit(source.slice(at), at);
  return out
    .split('\n')
    .map(
      (line, i) =>
        `<div class="ln${diagnostics.some((d) => d.line === i + 1) ? ' err' : ''}"><i>${i + 1}</i><span>${line || ' '}</span></div>`,
    )
    .join('');
}

/** A small layered layout: compact two-column graphs; >6 states use a vertical list. */
export function layoutGraph(layer: LayerM) {
  const vertical = layer.states.length > 6;
  const nodes = layer.states.map((s, i) => {
    const width = Math.max(64, Math.min(116, s.name.length * 7.2 + 38));
    return {
      name: s.name,
      x: vertical
        ? 100
        : [40, 170, layer.states[2]?.on.some((t) => t.to === 0) ? 170 : 105, 40, 170, 105][i]!,
      y: vertical ? 16 + i * 74 : 16 + Math.floor((i + 1) / 2) * (i > 1 ? 88 : 0),
      width,
      height: 28,
    };
  });
  const edges = layer.states.flatMap((s, from) =>
    s.on.map((t, index) => {
      const a = nodes[from]!,
        b = nodes[t.to]!;
      const forward = a.y === b.y;
      const reverse = t.to < from;
      let path: string, x: number, y: number;
      if (from === t.to) {
        path = `M${a.x + 20} ${a.y} C${a.x} ${a.y - 24} ${a.x + a.width} ${a.y - 24} ${a.x + a.width - 20} ${a.y}`;
        x = a.x + a.width / 2;
        y = a.y - 12;
      } else if (forward) {
        const yy = a.y + (reverse ? 20 : 10);
        path = `M${reverse ? a.x : b.x > a.x ? a.x + a.width : a.x} ${yy} H${reverse ? b.x + b.width : b.x}`;
        x = (a.x + a.width + b.x) / 2;
        y = yy + (reverse ? 15 : -5);
      } else if (a.x === b.x) {
        const down = b.y > a.y;
        x = a.x + a.width * (reverse ? 0.65 : 0.4);
        const sy = a.y + (down ? 28 : 0),
          ey = b.y + (down ? 0 : 28);
        path = `M${x} ${sy} V${ey}`;
        x += reverse ? 24 : -24;
        y = (sy + ey) / 2;
      } else {
        const down = b.y > a.y,
          sx = a.x + a.width * (reverse ? 0.35 : 0.7),
          sy = a.y + (down ? 28 : 0),
          ex = b.x + b.width * (reverse ? 0.35 : 0.7),
          ey = b.y + (down ? 0 : 28);
        path = `M${sx} ${sy} C${sx + (reverse ? -28 : 28)} ${(sy + ey) / 2} ${ex + (reverse ? -28 : 28)} ${(sy + ey) / 2} ${ex} ${ey}`;
        x = (sx + ex) / 2 + (reverse ? -34 : 25);
        y = (sy + ey) / 2;
      }
      return { from, to: t.to, index, path, x, y };
    }),
  );
  return {
    nodes,
    edges,
    width: Math.max(280, ...nodes.map((n) => n.x + n.width + 12)),
    height: Math.max(120, ...nodes.map((n) => n.y + 46)),
  };
}

/**
 * Timeline over the document's rest pose, independent of trigger queues and history. Data-bound
 * keyframes read the given player's data.
 */
export function sampleTimeline(
  model: Model,
  timeline: TimelineM,
  time: number,
  player?: Player,
): Record<string, unknown> {
  const t = Math.max(0, Math.min(timeline.duration, time));
  const pose: Record<string, unknown> = {};
  for (const [name, a] of model.addrs)
    pose[name] = Array.isArray(a.rest) && a.rest.length === 4 ? formatHex(a.rest) : a.rest;
  for (const tr of timeline.tracks) {
    const v = sampleTrack(tr, t, player);
    pose[tr.addr] = Array.isArray(v) && v.length === 4 ? formatHex(v) : v;
  }
  // Post-state property bindings would override the sampled pose (SPEC §11: timeline over rest).
  const doc: Record<string, unknown> = { ...model.doc };
  delete doc.bind;
  return {
    ...doc,
    machine: { layers: { scrub: { initial: 'sample', states: { sample: { pose } } } } },
    listeners: [],
  };
}
