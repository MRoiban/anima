import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseXml, type Element } from '../src/index.ts';

const bell = readFileSync(new URL('../../../examples/bell.animl', import.meta.url), 'utf8');

describe('AniML XML subset', () => {
  it('parses the reference document with positions', () => {
    const { doc, errors } = parseXml(bell);
    expect(errors).toEqual([]);
    const root = doc.root!;
    expect(root.name).toBe('anima');
    expect(root.attrs.find((a) => a.name === 'viewBox')!.value).toBe('-2 -2 24 24');
    expect(doc.outer).toHaveLength(1); // the file's leading comment
    const els = root.children.filter((c): c is Element => c.kind === 'element');
    const track = els
      .find((e) => e.name === 'timeline')!
      .children.find((c): c is Element => c.kind === 'element' && c.name === 'track')!;
    expect(track.attrs[0]!.value).toBe('swing.rotate');
    const t = track.children.find((c) => c.kind === 'text')!;
    // raw text keeps positions: the first keyframe starts on the line after <track>
    expect(t.at.line).toBe(track.at.line);
    const line = bell.split('\n')[track.at.line]!;
    expect(line.trim().startsWith('0 ')).toBe(true);
    // pos() maps offsets to 1-based lines/columns
    expect(doc.pos(0)).toEqual({ offset: 0, line: 1, col: 1 });
    const v = root.attrs[0]!.valueAt;
    expect(bell.slice(v.offset, v.offset + 3)).toBe('0.1');
  });

  it('accepts raw < and stray & in attribute values, decodes entities', () => {
    const { doc, errors } = parseXml(
      `<a when="level < 0.5 && on" x="&lt;&amp;&#65;&#x42;" y='it&apos;s'>t &amp; u<!-- c --></a>`,
    );
    expect(errors).toEqual([]);
    const a = doc.root!;
    expect(a.attrs.map((x) => x.value)).toEqual(['level < 0.5 && on', '<&AB', "it's"]);
    expect(a.children.map((c) => c.kind)).toEqual(['text', 'comment']);
    expect((a.children[0] as { value: string }).value).toBe('t & u');
  });

  it('allows an xml declaration and a BOM', () => {
    expect(parseXml('﻿<?xml version="1.0" encoding="UTF-8"?>\n<anima/>').errors).toEqual([]);
  });

  it.each([
    ['<a><!DOCTYPE x></a>', 1, 4, /DOCTYPE/],
    ['<a><![CDATA[x]]></a>', 1, 4, /CDATA/],
    ['<a><?pi x?></a>', 1, 4, /processing/],
    ['<x:a/>', 1, 3, /namespace/],
    ['<a>\n  <b>\n</a>', 3, 1, /<\/a> closes <b>/],
    ['<a x=1/>', 1, 6, /quoted/],
    ['<a x/>', 1, 5, /needs a value/],
    ['<a x="1"y="2"/>', 1, 9, /whitespace/],
    ['<a>', 1, 1, /not closed/],
    ['<a/><b/>', 1, 5, /one root/],
    ['', 1, 1, /empty/],
    ['text', 1, 1, /root element/],
    ['<a>x & y</a>', 1, 6, /&amp;/],
    ['<a><!-- open</a>', 1, 4, /comment/],
    ['<a>&#x110000;</a>', 1, 4, /Unicode range/],
    ['<a b="x&#1114112;"/>', 1, 8, /Unicode range/],
  ])('%j → error at %i:%i', (src, line, col, msg) => {
    const { doc, errors } = parseXml(src);
    expect(doc.root).toBeNull();
    expect(errors[0]).toMatchObject({ at: { line, col } });
    expect(errors[0]!.message).toMatch(msg);
  });

  it('never throws on any prefix of the reference document', () => {
    for (let i = 0; i < bell.length; i += 7) expect(() => parseXml(bell.slice(0, i))).not.toThrow();
  });
});
