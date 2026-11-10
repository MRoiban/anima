import { describe, expect, it } from 'vitest';
import { compile, decompile, formatMarkup, parseXml } from '../src/index.ts';

const base = (extra: Record<string, unknown> = {}) => ({
  anima: '0.1',
  name: 'probe',
  grid: 20,
  ...extra,
  nodes: [{ type: 'circle', id: 'dot', center: [10, 10], r: 5, fill: { color: '#000' } }],
});

describe('Rottweiler P1 AniML', () => {
  // R1-09: ANIML §8 round trip of an empty requires list.
  it('round-trips "requires": []', () => {
    const doc = base({ requires: [] });
    const built = compile(decompile(doc));
    expect(built.diagnostics).toEqual([]);
    expect(built.doc).toEqual(doc);
  });

  // R1-10: a `-->` in a $comment must not end the XML comment and inject markup.
  it('keeps a $comment containing --> a comment', () => {
    const doc = base({ $comment: 'hello --> <number name="injected"/> <!--' });
    const built = compile(decompile(doc));
    expect(built.diagnostics).toEqual([]);
    expect(built.doc!.inputs).toBeUndefined();
    expect(built.doc!.$comment).toBe(doc.$comment);
  });

  // R1-11: XML 1.0 forbids NUL, other C0 controls, U+FFFE/U+FFFF and lone surrogates.
  it.each([
    ['<a b="&#0;"/>', 1, 7],
    ['<a b="&#xD800;"/>', 1, 7],
    ['<a>&#xFFFE;</a>', 1, 4],
    ['<a b="x\u0001"/>', 1, 8],
    ['<a>\uDC00</a>', 1, 4],
  ])('rejects the non-XML character in %j at %i:%i', (src, line, col) => {
    const { doc, errors } = parseXml(src);
    expect(doc.root).toBeNull();
    expect(errors[0]!.at).toMatchObject({ line, col });
  });
  it('accepts tab, LF, CR and a surrogate pair', () => {
    const { doc, errors } = parseXml('<a b="\t\r\n&#x1F600;😀"/>');
    expect(errors).toEqual([]);
    expect(doc.root!.attrs[0]!.value).toBe('\t\r\n\u{1F600}\u{1F600}');
  });

  // R1-12: a lone CR ends a line (XML 1.0 end-of-line handling).
  it('counts CR and CRLF line endings in positions', () => {
    for (const nl of ['\r', '\r\n', '\n']) {
      const { errors } = parseXml(`<a>${nl}<b>${nl}  x & y</b></a>`);
      expect(errors[0]!.at).toMatchObject({ line: 3, col: 5 });
    }
  });
});

describe('Rottweiler P1 AniML round 3', () => {
  // R3-08: a metadata $comment survives decompile/build unchanged (ANIML §8).
  it('round-trips a metadata $comment through its JSON text', () => {
    for (const comment of ['\u0000', ' a ']) {
      const doc = base({ meta: { $comment: comment, owner: 'x' } });
      const built = compile(decompile(doc));
      expect(built.diagnostics).toEqual([]);
      expect(built.doc).toEqual(doc);
    }
  });
});

describe('Rottweiler P1 AniML round 4', () => {
  // R4-07: canonical comment literals escape characters XML forbids without losing their value.
  it('round-trips non-XML characters of a $comment exactly', () => {
    const doc = base({ $comment: 'a\u0000b' });
    const built = compile(decompile(doc));
    expect(built.diagnostics).toEqual([]);
    expect(built.doc!.$comment).toBe(doc.$comment);
  });
});

describe('Rottweiler P1 AniML round 5', () => {
  const xml = (body: string) =>
    `<anima version="0.1" name="probe" grid="20"><circle id="dot" cx="10" cy="10" r="5" fill="#000"/>${body}</anima>`;
  const reformat = (source: string) => {
    const first = compile(source);
    expect(first.diagnostics).toEqual([]);
    const text = formatMarkup(source).text!;
    const again = compile(text);
    expect(again.diagnostics).toEqual([]);
    expect(again.doc).toEqual(first.doc);
    return text;
  };

  // R5-02: CR separates keyframes in the formatter, as in the compiler.
  it('formats CR-separated keyframes', () => {
    reformat(
      xml('<timeline name="t" duration="1"><track target="dot.r">0 0\r1 1</track></timeline>'),
    );
  });

  // R5-03: a comment inside a key row or the metadata JSON keeps the content verbatim.
  it('keeps track and metadata content that a comment splits', () => {
    expect(
      reformat(
        xml(
          '<timeline name="t" duration="1"><track target="dot.r">0 <!-- why -->5;1 6</track></timeline>',
        ),
      ),
    ).toContain('<track target="dot.r">0 <!-- why -->5;1 6</track>');
    reformat(xml('<meta>{"x":"a<!-- why -->b"}</meta>'));
    // A comment between rows still reflows.
    expect(
      reformat(
        xml(
          '<timeline name="t" duration="1"><track target="dot.r">0 5\n<!-- why -->\n1 6</track></timeline>',
        ),
      ),
    ).toContain('<!-- why -->');
  });

  // R5-05: strings with characters XML forbids decompile to markup that builds.
  it('writes non-XML characters in any string as U+FFFD', () => {
    const built = compile(decompile(base({ title: 'a\u0000b\ud800' })));
    expect(built.diagnostics).toEqual([]);
    expect(built.doc!.title).toBe('a�b�');
  });
});
