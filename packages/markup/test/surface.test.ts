import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile, decompile, formatMarkup } from '../src/index.ts';
import { formatAni, registerModule, type ObjShape } from '@anima-format/core';
const read = (path: string) => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8');
const wrap = (body: string) =>
  `<anima version="0.1" name="surface" grid="24" requires="paint composite surface">${body}</anima>`;

describe('nested surface markup', () => {
  it.each(['slice', 'feather', 'image'])(
    '%s draw conformance input preserves every value and pointer',
    (kind) => {
      const dir = `spec/draw-conformance/surface-${kind}/`;
      const result = compile(read(dir + 'case.animl'));
      expect(result.diagnostics).toEqual([]);
      expect(result.text).toBe(formatAni(JSON.parse(read(dir + 'case.ani'))));
      expect(compile(decompile(result.doc!)).doc).toEqual(result.doc);
      expect(formatMarkup(read(dir + 'case.animl')).text).toBe(read(dir + 'case.animl'));
    },
  );
  it.each(['slice', 'feather'])('standalone %s survives both round trips', (name) => {
    const source = read(`examples/${name}.animl`);
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(read(`examples/${name}.ani`));
    expect(compile(decompile(result.doc!)).doc).toEqual(result.doc);
    expect(decompile(compile(decompile(result.doc!)).doc!)).toBe(decompile(result.doc!));
  });
  it('preserves flat, gradient and ordered paints and maps tuple components to the attribute', () => {
    const source = wrap(`<rect id="r" x0="0" y0="0" width="8" height="8" fill="#f00">
      <feather outer="3" offset="1,-2" enabled="false" space="local"/>
      <linearGradient paint="stroke" x1="0" y1="0" x2="8" y2="8"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>
      <feather paint="stroke" inner="2"/>
    </rect><rect id="ordered" x0="0" y0="0" width="8" height="8">
      <fillPaint fill="#abc"><feather inner="1" outer="2" offset="-1 2"/></fillPaint>
      <strokePaint stroke="#def" stroke-width="2" stroke-dasharray="2 4"><feather paint="stroke" enabled="false" space="world"/></strokePaint>
    </rect>`);
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.doc).toMatchObject({
      nodes: [
        {
          fill: {
            color: '#f00',
            feather: { outer: 3, offset: [1, -2], enabled: false, space: 'local' },
          },
          stroke: { type: 'linear', feather: { inner: 2 } },
        },
        {
          paints: [
            { fill: { color: '#abc', feather: { inner: 1, outer: 2, offset: [-1, 2] } } },
            { stroke: { color: '#def', width: 2, feather: { enabled: false, space: 'world' } } },
          ],
        },
      ],
    });
    expect(compile(decompile(result.doc!)).doc).toEqual(result.doc);
    const at = result.map.get('/nodes/0/fill/feather/offset/1')!;
    expect(at).toMatchObject({ line: 2, col: 34 });
    expect(result.map.get('/nodes/1/paints/0/fill/feather/offset/0')).toBeDefined();
  });

  it('preserves ordered image paints alongside independent feather objects', () => {
    const d = JSON.parse(read('spec/draw-conformance/surface-image/case.ani'));
    d.requires.push('composite');
    const n = d.nodes[0];
    n.paints = [
      { fill: { color: '#abc', feather: {} } },
      {
        stroke: {
          ...n.fill,
          width: 2,
          feather: { inner: 2, outer: 4, offset: [1, -1], enabled: false, space: 'local' },
        },
      },
    ];
    delete n.fill;
    d.timelines.move.tracks = {
      'tile.paints.1.stroke.imageX': d.timelines.move.tracks['tile.fill.imageX'],
    };
    const text = decompile(d);
    expect(text).toContain('<strokePaint');
    expect(text).toContain('type="image"');
    expect(text).toContain('<feather inner="2" outer="4"');
    expect(compile(text).diagnostics).toEqual([]);
    expect(compile(text).doc).toEqual(d);
  });

  it.each([
    ['2 4', [2, 4]],
    ['10% 5%', ['10%', '5%']],
  ])('preserves ordered dash arrays %s', (dash, expected) => {
    const source = wrap(
      `<circle id="dot" cx="4" cy="4" r="2"><strokePaint stroke="#000" stroke-dasharray="${dash}"><feather outer="1"/></strokePaint></circle>`,
    );
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.doc).toMatchObject({
      nodes: [{ paints: [{ stroke: { dash: expected, feather: { outer: 1 } } }] }],
    });
    expect(compile(decompile(result.doc!)).doc).toEqual(result.doc);
  });
  it('keeps the strict one-unit rule for ordered dash arrays', () => {
    const result = compile(
      wrap(
        '<circle id="dot" cx="4" cy="4" r="2"><strokePaint stroke="#000" stroke-dasharray="2 10%"/></circle>',
      ),
    );
    expect(result.doc).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'bad-value',
        pointer: '/nodes/0/paints/0/stroke/dash',
        hint: 'use all grid lengths or all percentages',
      }),
    );
  });
  it('routes slices on images, groups and component instances', () => {
    const source = `<anima version="0.1" name="slice" grid="24" requires="components surface">
      <component name="badge" grid="8"><circle id="dot" cx="4" cy="4" r="2" fill="#000"/></component>
      <group id="g"><slice x="0,2,6,8" y="0 8" width="16" height="8" modes="stretch repeat hidden"/><circle id="dot" cx="4" cy="4" r="2" fill="#000"/></group>
      <instance id="i" component="badge"><slice x="0 8" y="0 8" width="16" height="16"/></instance>
    </anima>`;
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.doc).toMatchObject({
      nodes: [
        { slice: { x: [0, 2, 6, 8], y: [0, 8], modes: ['stretch', 'repeat', 'hidden'] } },
        { slice: { width: 16, height: 16 } },
      ],
    });
    expect(compile(decompile(result.doc!)).doc).toEqual(result.doc);
  });
  it.each([
    ['bad-value', '/nodes/0/fill/feather/offset', '<feather offset="1"/>'],
    ['bad-attribute', '/nodes/0/fill/feather/offset/1', '<feather offset="0 NaN"/>'],
    ['bad-value', '/nodes/0/fill/feather/outer', '<feather outer="-1"/>'],
    ['bad-attribute', '/nodes/0', '<feather paint="invalid"/>'],
    ['duplicate-name', '/nodes/0/fill/feather', '<feather inner="1"/><feather outer="2"/>'],
  ])('%s at %s has source location', (code, pointer, child) => {
    const result = compile(
      wrap(`<rect id="r" x0="0" y0="0" width="8" height="8" fill="#f00">${child}</rect>`),
    );
    expect(result.doc).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        pointer,
        message: expect.any(String),
        line: 1,
        column: expect.any(Number),
      }),
    );
  });
  it('rejects conflicting ordered-paint selectors and duplicate nested objects', () => {
    for (const child of ['<feather paint="stroke"/>', '<feather inner="1"/><feather outer="2"/>']) {
      const result = compile(
        wrap(
          `<circle id="r" cx="4" cy="4" r="2"><fillPaint fill="#f00">${child}</fillPaint></circle>`,
        ),
      );
      expect(result.doc).toBeUndefined();
      expect(result.diagnostics[0]).toMatchObject({
        pointer: '/nodes/0/paints/0/fill/feather',
        line: 1,
      });
    }
  });
  it('preserves empty feather objects and rejects duplicate empty declarations', () => {
    const source = wrap('<circle id="dot" cx="4" cy="4" r="2" fill="#000"><feather/></circle>');
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    expect(compile(decompile(result.doc!)).doc).toEqual(result.doc);
    expect(
      compile(source.replace('<feather/>', '<feather/><feather/>')).diagnostics,
    ).toContainEqual(
      expect.objectContaining({
        code: 'duplicate-name',
        pointer: '/nodes/0/fill/feather',
        hint: expect.any(String),
      }),
    );
  });
  it('decodes scalar arrays and heterogeneous tuples from their descriptor shapes', () => {
    const shape: ObjShape = {
      k: 'obj',
      p: {
        numbers: { k: 'arr', of: { k: 'num' } },
        flags: { k: 'arr', of: { k: 'bool' } },
        tuple: { k: 'tup', of: [{ k: 'str' }, { k: 'bool' }, { k: 'num' }], min: 3 },
      },
    };
    registerModule({
      name: 'scalars',
      entries: [
        {
          target: 'group',
          shapes: { scalars: { ...shape, element: 'scalars' } },
          elements: {
            scalars: {
              shape,
              target: { attribute: 'for', default: 'scalars', choices: ['scalars'] },
            },
          },
        },
      ],
    });
    const source =
      '<anima version="0.1" name="scalars" grid="8" requires="scalars"><group id="g"><scalars numbers="1,2.5,-3" flags="true false" tuple="local true 3"/></group></anima>';
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.doc).toMatchObject({
      nodes: [
        { scalars: { numbers: [1, 2.5, -3], flags: [true, false], tuple: ['local', true, 3] } },
      ],
    });
    expect(compile(decompile(result.doc!)).doc).toEqual(result.doc);
    expect(compile(source.replace('true false', 'true maybe')).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'bad-attribute', pointer: '/nodes/0/scalars/flags/1' }),
    );
  });
});
