import { describe, expect, it } from 'vitest';
import { compile, decompile, parseXml } from '../src/index.ts';

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
    expect(built.doc!.$comment).toBe('hello -- > <number name="injected"/> <!--');
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
  // R4-07: a $comment with a character XML forbids still decompiles to markup that builds.
  it('writes non-XML characters of a $comment as U+FFFD', () => {
    const built = compile(decompile(base({ $comment: 'a\u0000b' })));
    expect(built.diagnostics).toEqual([]);
    expect(built.doc!.$comment).toBe('a�b');
  });
});
