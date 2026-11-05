import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile, decompile, formatMarkup } from '../../../../packages/markup/src/index.ts';
import { registerModule, load, Player, toSVG } from '@anima-format/core';

const source = readFileSync(new URL('../../../../examples/paint.animl', import.meta.url), 'utf8');
const wrap = (body: string, requires = 'paint') =>
  `<anima version="0.1" name="paint" grid="20" requires="${requires}"><circle id="a" cx="10" cy="10" r="8"${body}</circle></anima>`;
const stops = '<stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/>';
const linear = `<linearGradient x1="0" y1="0" x2="20" y2="0">${stops}</linearGradient>`;

describe('paint authoring', () => {
  it('round-trips the example including alpha, slots, both gradient types and relative dashes', () => {
    const built = compile(source);
    expect(built.diagnostics).toEqual([]);
    expect(compile(decompile(built.doc!)).text).toBe(built.text);
    expect(formatMarkup(source).text).toBe(source);
  });

  it('maps semantic stop errors precisely to their attribute values', () => {
    const text = wrap('>' + linear.replace('offset="1"', 'offset="2"'));
    const r = compile(text);
    const d = r.diagnostics.find((d) => d.code === 'bad-value')!;
    expect(d.pointer).toBe('/nodes/0/fill/stops/1/position');
    expect(d.line).toBe(1);
    expect(d.column).toBe(text.indexOf('offset="2"') + 'offset="'.length + 1);
  });

  it('names the AniML requires declaration in its hint', () => {
    const r = compile(wrap(' stroke="#000" stroke-dasharray="2 1">', 'knockout'));
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'undeclared-feature',
        pointer: '/nodes/0/stroke/dash',
        hint: 'add requires="paint" to <anima>',
      }),
    );
  });

  it.each([
    ['paint-attribute', ' fill="#000">' + linear],
    ['paint-attribute', '>' + linear + linear],
    ['bad-attribute', '>' + linear.replace('<linearGradient ', '<linearGradient paint="wrong" ')],
    ['missing-attribute', '>' + linear.replace(' x1="0"', '')],
    ['bad-value', '>' + linear.replace(stops, '<stop offset="0" stop-color="#000"/>')],
    ['paint-attribute', ' stroke-dasharray="2 1">'],
    ['unknown-attribute', '>' + linear.replace(' x1="0"', ' xStart="0"')],
  ])('reports %s for invalid module markup', (code, body) => {
    const r = compile(wrap(body));
    expect(r.doc).toBeUndefined();
    expect(r.diagnostics.some((d) => d.code === code)).toBe(true);
  });

  it('authors a new module node from entries and a load hook without changing core/markup dispatch', () => {
    registerModule({
      name: 'geometry',
      entries: [
        {
          target: 'segment',
          node: { painted: true },
          shapes: { endpoint: { k: 'num' } },
          required: ['id', 'type', 'endpoint'],
        },
      ],
      load(model) {
        for (const n of model.nodes)
          if (n.raw.type === 'segment') {
            n.type = 'path';
            n.d = `M0 0L${n.raw.endpoint} 0`;
          }
      },
    });
    const text =
      '<anima version="0.1" name="module-node" grid="20" requires="geometry"><segment id="a" endpoint="20" stroke="#000"/></anima>';
    const r = compile(text);
    expect(r.diagnostics).toEqual([]);
    expect(compile(decompile(r.doc!)).text).toBe(r.text);
    expect(toSVG(new Player(load(r.doc!).model!))).toContain('d="M0 0L20 0"');
    expect(compile(text.replace(' requires="geometry"', '')).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'undeclared-feature', pointer: '/nodes/0/endpoint' }),
    );
  });

  it('accepts registered versioned module feature names in requires', () => {
    registerModule({ name: 'authoring@2', entries: [] });
    expect(
      compile(
        '<anima version="0.1" name="versioned" grid="20" requires="authoring@2"><group id="a"/></anima>',
      ).diagnostics,
    ).toEqual([]);
  });
});
