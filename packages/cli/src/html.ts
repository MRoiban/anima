// HTML build-time embedding (ANIML §9). Scan tags and raw-text elements without reserialising
// the page: only a matching script's type value and body may change.
import { readFileSync } from 'node:fs';
import { formatAni } from '@anima-format/core';
import { compile, type MarkupDiagnostic } from '@anima-format/markup';
import { lineCol } from './locate.ts';

interface Edit {
  start: number;
  end: number;
  text: string;
}

export function buildHTML(
  source: string,
  file: string,
  transform?: (doc: object) => void,
): {
  text?: string;
  diagnostics: MarkupDiagnostic[];
} {
  const diagnostics: MarkupDiagnostic[] = [];
  const edits: Edit[] = [];
  let icons = 0;
  let i = 0;
  while (i < source.length) {
    const start = source.indexOf('<', i);
    if (start < 0) break;
    if (source.startsWith('<!--', start)) {
      const end = source.indexOf('-->', start + 4);
      i = end < 0 ? source.length : end + 3;
      continue;
    }
    if (!/^<\/?[a-z!]/i.test(source.slice(start, start + 3))) {
      i = start + 1;
      continue;
    }
    // A quoted '>' belongs to the attribute, not the tag boundary.
    let end = start + 1;
    let quote = '';
    for (; end < source.length; end++) {
      const c = source[end]!;
      if (quote) {
        if (c === quote) quote = '';
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
    }
    i = end + 1;
    const tag = source.slice(start, i);
    const name = /^<\s*(\/?)\s*([a-z][\w:-]*)\b/i.exec(tag);
    if (!name) continue;
    const closing = !!name[1];
    const kind = name[2]!.toLowerCase();
    if (kind === 'anima-icon') icons = Math.max(0, icons + (closing ? -1 : 1));
    if (kind === 'plaintext' && !closing) break;
    if (
      closing ||
      !['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes'].includes(
        kind,
      )
    )
      continue;
    const close = new RegExp(`</${kind}\\s*>`, 'ig');
    close.lastIndex = i;
    const match = close.exec(source);
    const bodyEnd = match?.index ?? source.length;
    const bodyStart = i;
    i = match ? close.lastIndex : source.length;
    if (kind !== 'script') continue;
    // Tokenise all attributes so a type-looking string inside another value is ignored.
    const attrs = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    attrs.lastIndex = name[0].length;
    let type: { value: string; start: number; end: number } | undefined;
    for (let a = attrs.exec(tag); a; a = attrs.exec(tag)) {
      if (a[1]!.toLowerCase() !== 'type' || type) continue;
      const value = a[2] ?? a[3] ?? a[4] ?? '';
      const eq = a[0].indexOf('=');
      const prefix =
        eq < 0 ? a[0].length : eq + 1 + (a[0].slice(eq + 1).match(/^\s*/)?.[0].length ?? 0);
      const offset = a.index + prefix + (a[2] !== undefined || a[3] !== undefined ? 1 : 0);
      type = { value, start: start + offset, end: start + offset + value.length };
    }
    if (type?.value.toLowerCase() !== 'application/vnd.anima+xml') continue;
    if (!icons) {
      const [line, column] = lineCol(source, start);
      diagnostics.push({
        file,
        line,
        column,
        code: 'markup-outside-icon',
        severity: 'warning',
        pointer: '',
        message: 'AniML script outside <anima-icon> was left unchanged',
        hint: 'wrap the script in <anima-icon> to compile it',
      });
      continue;
    }
    const result = compile(source.slice(bodyStart, bodyEnd), {
      file,
      resolve: (path) => readFileSync(path, 'utf8'),
    });
    const [line, column] = lineCol(source, bodyStart);
    diagnostics.push(
      ...result.diagnostics.map((d) => ({
        ...d,
        ...(d.related
          ? {
              related: d.related.map((r) =>
                r.file === file
                  ? {
                      ...r,
                      line: line + r.line - 1,
                      column: r.column + (r.line === 1 ? column - 1 : 0),
                    }
                  : r,
              ),
            }
          : {}),
        line: d.file === file ? line + (d.line ?? 1) - 1 : d.line,
        column:
          d.file === file ? (d.column ?? 1) + ((d.line ?? 1) === 1 ? column - 1 : 0) : d.column,
      })),
    );
    if (result.text !== undefined) {
      if (transform && result.doc) {
        transform(result.doc);
        result.text = formatAni(result.doc);
      }
      edits.push({ start: type.start, end: type.end, text: 'application/vnd.anima+json' });
      // HTML raw-text ends at </script even inside a JSON string.
      edits.push({ start: bodyStart, end: bodyEnd, text: result.text.replace(/</g, '\\u003c') });
    }
  }
  if (diagnostics.some((d) => d.severity === 'error')) return { diagnostics };
  let text = source;
  for (const edit of edits.reverse())
    text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
  return { text, diagnostics };
}
