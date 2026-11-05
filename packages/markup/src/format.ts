import type { MarkupDiagnostic } from './index.ts';
import { type LayoutElement, render } from './layout.ts';
import { parseXml, type Element } from './xml.ts';

/** Layout-only formatting: retain order, comments, values, and the author's track style. */
export function formatMarkup(source: string): { text?: string; diagnostics: MarkupDiagnostic[] } {
  const { doc, errors } = parseXml(source);
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
