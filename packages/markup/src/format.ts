import type { MarkupDiagnostic } from './index.ts';
import { type LayoutElement, render } from './layout.ts';
import { parseXml, type Element } from './xml.ts';

/** Layout-only formatting: retain order, comments, values, and the author's track style. */
export function formatMarkup(source: string): { text?: string; diagnostics: MarkupDiagnostic[] } {
  let parsed: ReturnType<typeof parseXml>;
  try {
    parsed = parseXml(source);
  } catch (error) {
    // parseXml currently lets String.fromCodePoint throw for out-of-range entities.
    // Keep the public formatter diagnostic-only without changing that shared contract.
    if (!(error instanceof RangeError)) throw error;
    const entity = [...source.matchAll(/&#(x[0-9a-fA-F]+|[0-9]+);/g)].find(
      (m) => (m[1]!.startsWith('x') ? parseInt(m[1]!.slice(1), 16) : Number(m[1])) > 0x10ffff,
    );
    const prefix = source.slice(0, entity?.index ?? 0);
    return {
      diagnostics: [
        {
          code: 'markup-syntax',
          severity: 'error',
          pointer: '',
          message: 'numeric character reference is outside the Unicode range',
          line: prefix.split('\n').length,
          column: prefix.length - prefix.lastIndexOf('\n'),
        },
      ],
    };
  }
  const { doc, errors } = parsed;
  if (errors.length)
    return {
      diagnostics: errors.map((e) => ({
        code: 'markup-syntax',
        severity: 'error',
        pointer: '',
        message: e.message,
        line: e.at.line,
        column: e.at.col,
      })),
    };
  const convert = (el: Element): LayoutElement => {
    const out: LayoutElement = {
      name: el.name,
      attrs: el.attrs.map((a) => [a.name, a.value]),
      children: [],
    };
    let blank = false;
    for (const c of el.children) {
      if (c.kind === 'text' && !c.value.trim()) {
        blank ||= /\n\s*\n/.test(c.value);
        continue;
      }
      if (c.kind === 'element') out.children.push({ ...convert(c), blank });
      else if (c.kind === 'comment') out.children.push({ comment: c.value, blank });
      else out.children.push({ text: c.value });
      blank = false;
    }
    return out;
  };
  const root = doc.root!;
  const before = doc.outer.filter((c) => c.at.offset < root.at.offset);
  const after = doc.outer.filter((c) => c.at.offset > root.at.offset);
  return {
    text:
      [
        ...before.map((c) => `<!--${c.value}-->`),
        render(convert(root)),
        ...after.map((c) => `<!--${c.value}-->`),
      ].join('\n') + '\n',
    diagnostics: [],
  };
}
