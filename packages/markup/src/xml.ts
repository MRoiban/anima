// The XML subset AniML is written in (spec/ANIML.md §1), with positions for every node and attribute
// value so diagnostics point at the markup. Dependency-free; runs in the browser too.

import { VERBOSE } from '@anima-format/core';

export interface Pos {
  file?: string;
  related?: Pos;
  locate?: (offset: number) => Pos;
  /** 0-based offset into the text. */
  offset: number;
  /** 1-based line and column. */
  line: number;
  col: number;
}

export interface Attr {
  name: string;
  /** Entity-decoded value. */
  value: string;
  /** Where the attribute name starts. */
  at: Pos;
  /** Where the value starts (the first character inside the quotes). */
  valueAt: Pos;
}

export interface Element {
  kind: 'element';
  name: string;
  attrs: Attr[];
  children: Child[];
  at: Pos;
}

export interface Text {
  /** Expanded raw character → original source offset. */
  offsets?: number[];
  kind: 'text';
  /** Entity-decoded text. */
  value: string;
  /** The text exactly as written (for positions inside it, e.g. keyframes). */
  raw: string;
  at: Pos;
}

export interface Comment {
  kind: 'comment';
  value: string;
  at: Pos;
}

export type Child = Element | Text | Comment;

export interface XmlError {
  message: string;
  at: Pos;
}

export interface XmlDocument {
  /** The root element, or null when there were errors. */
  root: Element | null;
  /** Comments before and after the root element. */
  outer: Comment[];
  /** Position of any offset in the text. */
  pos(offset: number): Pos;
}

const NAME = /[A-Za-z_][A-Za-z0-9._-]*/y;
const ENTITY = /&(?:(amp|lt|gt|quot|apos)|#([0-9]{1,7})|#x([0-9a-fA-F]{1,6}));/y;
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
/** Characters XML 1.0 forbids, literally or as a reference (lone surrogates included). */
export const NOT_CHAR =
  /[\0-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

/**
 * Decode entities. In attribute values a `&` that does not start an entity stands for itself
 * (the AniML leniency); in text it is an error, reported through `bad`.
 */
function decode(s: string, lenient: boolean, bad: (i: number, message?: string) => void): string {
  if (!s.includes('&')) return s;
  let out = '';
  for (let i = 0; i < s.length;) {
    if (s[i] !== '&') {
      out += s[i++];
      continue;
    }
    ENTITY.lastIndex = i;
    const m = ENTITY.exec(s);
    const cp = m && !m[1] ? (m[2] ? parseInt(m[2], 10) : parseInt(m[3]!, 16)) : 0;
    if (m && (m[1] || !(cp > 0x10ffff || NOT_CHAR.test(String.fromCodePoint(cp))))) {
      out += m[1] ? NAMED[m[1]]! : String.fromCodePoint(cp);
      i = ENTITY.lastIndex;
    } else if (m) {
      bad(
        i,
        VERBOSE
          ? 'numeric character reference is outside the Unicode range or not an XML character'
          : '',
      );
      out += m[0];
      i = ENTITY.lastIndex;
    } else {
      if (!lenient) bad(i);
      out += '&';
      i++;
    }
  }
  return out;
}

/** Parse AniML's XML subset. Never throws; problems come back as errors with positions. */
export function parseXml(text: string): { doc: XmlDocument; errors: XmlError[] } {
  const lineStarts = [0];
  // A line ends at LF, CRLF or a lone CR (XML 1.0 end-of-line handling).
  for (const m of text.matchAll(/\r\n?|\n/g)) lineStarts.push(m.index + m[0].length);
  const pos = (offset: number): Pos => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid]! <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { offset, line: lo + 1, col: offset - lineStarts[lo]! + 1 };
  };
  const errors: XmlError[] = [];
  const outer: Comment[] = [];
  const doc: XmlDocument = { root: null, outer, pos };
  let i = 0;
  class Stop extends Error {}
  const fail = (message: string, at = i): never => {
    errors.push({ message, at: pos(at) });
    throw new Stop();
  };
  const name = (): string => {
    NAME.lastIndex = i;
    const m = NAME.exec(text);
    if (!m) fail(VERBOSE ? 'expected a name' : '');
    i = NAME.lastIndex;
    if (text[i] === ':') fail(VERBOSE ? 'namespace prefixes are not allowed in AniML' : '');
    return m![0];
  };
  const ws = () => {
    while (i < text.length && /\s/.test(text[i]!)) i++;
  };
  const comment = (): Comment => {
    const at = i;
    const end = text.indexOf('-->', i + 4);
    if (end < 0) fail(VERBOSE ? 'comment is not closed with -->' : '', at);
    const c: Comment = { kind: 'comment', value: text.slice(i + 4, end), at: pos(at) };
    i = end + 3;
    return c;
  };
  const special = () => {
    if (text.startsWith('<![CDATA[', i))
      fail(VERBOSE ? 'CDATA sections are not allowed in AniML' : '');
    if (text.startsWith('<!', i))
      fail(VERBOSE ? 'DOCTYPE and other declarations are not allowed in AniML' : '');
    if (text.startsWith('<?', i))
      fail(
        VERBOSE
          ? 'processing instructions are not allowed in AniML (only an <?xml …?> declaration at the very start)'
          : '',
      );
  };
  const element = (depth: number): Element => {
    if (depth > 256) fail(VERBOSE ? 'elements nest too deeply' : '');
    const at = i;
    i++; // <
    const el: Element = { kind: 'element', name: name(), attrs: [], children: [], at: pos(at) };
    for (;;) {
      const before = i;
      ws();
      if (text.startsWith('/>', i)) {
        i += 2;
        return el;
      }
      if (text[i] === '>') {
        i++;
        break;
      }
      if (i >= text.length) fail(VERBOSE ? `<${el.name}> is not closed` : '', at);
      if (i === before) fail(VERBOSE ? 'expected whitespace before the attribute' : '');
      const aAt = i;
      const aName = name();
      ws();
      if (text[i] !== '=') fail(VERBOSE ? `attribute "${aName}" needs a value (name="value")` : '');
      i++;
      ws();
      const q = text[i];
      if (q !== '"' && q !== "'") fail(VERBOSE ? `the value of "${aName}" must be quoted` : '');
      const vStart = i + 1;
      const vEnd = text.indexOf(q!, vStart);
      if (vEnd < 0) fail(VERBOSE ? `the value of "${aName}" is not closed` : '', vStart - 1);
      // A repeated attribute is kept; the compiler reports it as duplicate-attribute.
      el.attrs.push({
        name: aName,
        value: decode(text.slice(vStart, vEnd), true, (k, message) => {
          if (message !== undefined) errors.push({ message, at: pos(vStart + k) });
        }),
        at: pos(aAt),
        valueAt: pos(vStart),
      });
      i = vEnd + 1;
    }
    // children
    for (;;) {
      if (i >= text.length) fail(VERBOSE ? `<${el.name}> is not closed` : '', at);
      if (text.startsWith('</', i)) {
        const closeAt = i;
        i += 2;
        const n = name();
        ws();
        if (text[i] !== '>') fail(VERBOSE ? `expected > after </${n}` : '');
        i++;
        if (n !== el.name)
          fail(
            VERBOSE ? `</${n}> closes <${el.name}> (opened at line ${el.at.line})` : '',
            closeAt,
          );
        return el;
      }
      if (text.startsWith('<!--', i)) {
        el.children.push(comment());
        continue;
      }
      if (text[i] === '<') {
        special();
        el.children.push(element(depth + 1));
        continue;
      }
      const tAt = i;
      let end = text.indexOf('<', i);
      if (end < 0) end = text.length;
      const raw = text.slice(i, end);
      const value = decode(raw, false, (k, message) =>
        errors.push({
          message: VERBOSE ? (message ?? 'a bare & in text must be written &amp;') : '',
          at: pos(tAt + k),
        }),
      );
      el.children.push({ kind: 'text', value, raw, at: pos(tAt) });
      i = end;
    }
  };
  try {
    const bad = NOT_CHAR.exec(text);
    if (bad) fail(VERBOSE ? 'this character is not allowed in XML' : '', bad.index);
    if (text.charCodeAt(0) === 0xfeff) i = 1;
    if (text.startsWith('<?xml', i)) {
      const end = text.indexOf('?>', i);
      if (end < 0) fail(VERBOSE ? 'the <?xml declaration is not closed' : '');
      i = end + 2;
    }
    for (;;) {
      ws();
      if (i >= text.length) break;
      if (text.startsWith('<!--', i)) {
        outer.push(comment());
        continue;
      }
      if (text[i] !== '<')
        fail(
          VERBOSE
            ? doc.root
              ? 'text after the root element'
              : 'expected the <anima> root element'
            : '',
        );
      special();
      if (doc.root) fail(VERBOSE ? 'only one root element is allowed' : '');
      doc.root = element(0);
    }
    if (!doc.root) fail(VERBOSE ? 'the document is empty: expected <anima …>' : '');
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    doc.root = null;
  }
  if (errors.length) doc.root = null;
  return { doc, errors };
}

/** Characters XML forbids become U+FFFD, so written markup always parses again (ANIML §8). */
export const xmlChars = (s: string): string => s.replace(new RegExp(NOT_CHAR, 'g'), '\ufffd');

/** Escape text for an attribute value written with double quotes. */
export const escapeAttr = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** Escape element text. */
export const escapeText = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
