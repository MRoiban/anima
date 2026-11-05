import '@anima-format/core/all';
import { describe, expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { BindError, expression, evaluate } from '../../core/index.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';

const doc = (bind: object, extra: object = {}) => ({
  anima: '0.1',
  name: 'bound',
  grid: 20,
  requires: ['bind'],
  inputs: {
    n: { type: 'number', default: 0.25 },
    flag: { type: 'bool' },
    pulse: { type: 'trigger' },
  },
  nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 8, fill: { color: '#000' } }],
  bind,
  ...extra,
});
const scope = new Map<string, number | boolean>([
  ['n', 0.25],
  ['flag', true],
]);
const types = new Map([
  ['n', 'number'],
  ['flag', 'bool'],
]);
describe('bind expressions', () => {
  it.each([
    ['1 + 2 * 3', 7],
    ['(1 + 2) * 3', 9],
    ['8 / 2 / 2 - 1', 1],
    ['-n + +2', 1.75],
    ['min(4, 2)', 2],
    ['max(4, 2)', 4],
    ['clamp(4, 0, 1)', 1],
    ['mix(2, 6, n)', 3],
    ['flag * 3', 3],
    ['1 / 0', 0],
    ['0 / 0', 0],
    ['1e308 * 1e308', 0],
    ['mix(#000, #fff, n)', [64, 64, 64, 255]],
    ['mix(#000, #fff, 1 / 0)', [0, 0, 0, 255]],
    ['(1 / 0) + 2', 2],
  ])('%s', (src, value) => expect(evaluate(expression(src, types), scope)).toEqual(value));
  it('evaluates against independent named scopes for component callers', () => {
    const e = expression('n * 2', types);
    expect(evaluate(e, new Map([['n', 3]]))).toBe(6);
    expect(evaluate(e, new Map([['n', 5]]))).toBe(10);
  });
  it.each([
    '',
    '1 +',
    'sin(n)',
    'min(1)',
    'mix(#fff, 0, n)',
    '#ffff',
    'n.x',
    'true',
    '1 2',
    '1e999',
    '"x"',
    '2 ** 3',
    'clamp(1,2,3,4)',
    '('.repeat(70) + 'n' + ')'.repeat(70),
    Array(300).fill('1').join('+'),
  ])('rejects %s without throwing from load', (src) => {
    expect(load(doc({ 'dot.x': src })).model).toBeUndefined();
  });
  it('keeps token offsets on parser errors', () => {
    try {
      expression('n + missing', types);
      throw Error('accepted');
    } catch (err) {
      expect(err).toBeInstanceOf(BindError);
      expect(err).toMatchObject({ code: 'unknown-input', at: 4 });
    }
  });
});
describe('bind loading and playback', () => {
  it.each([
    ['bind-type', 'dot.x', '#fff'],
    ['bind-type', 'dot.visible', 'n'],
    ['bind-type', 'dot.fill.color', 'n'],
    ['bind-type', 'dot.x', 'pulse'],
    ['unknown-input', 'dot.x', 'missing'],
    ['bind-syntax', 'dot.x', 'n +'],
    ['bind-cycle', 'dot.x', 'dot.x'],
    ['unknown-address', 'absent.x', 'n'],
    ['not-animatable', 'dot.type', 'n'],
  ])('%s at the binding pointer', (code, target, src) => {
    const r = load(doc({ [target]: src }));
    expect(r.model).toBeUndefined();
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        pointer: '/bind/' + target,
        hint: expect.any(String),
        message: expect.any(String),
      }),
    );
  });
  it('rejects indirect cycles', () => {
    expect(
      load(doc({ 'dot.x': 'dot.y', 'dot.y': 'dot.x' })).diagnostics.some(
        (d) => d.code === 'bind-cycle',
      ),
    ).toBe(true);
  });
  it('requires the module declaration', () => {
    expect(load(doc({ 'dot.x': 'n' }, { requires: [] })).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'undeclared-feature', pointer: '/bind' }),
    );
  });
  it('binds bool directly and as 0/1, clamps after binding, and tracks dirty values', () => {
    const r = load(doc({ 'dot.opacity': 'n * 8', 'dot.visible': 'flag', 'dot.x': 'flag' }));
    expect(r.model).toBeDefined();
    expect(r.diagnostics.some((d) => d.code === 'unused-input' && d.pointer === '/inputs/n')).toBe(
      false,
    );
    const p = new Player(r.model!);
    p.step(0);
    expect(p.values()).toEqual({ 'dot.opacity': 1, 'dot.visible': false, 'dot.x': 0 });
    p.takeDirty();
    p.set('flag', true);
    p.step(0);
    expect(p.value('dot.visible')).toBe(true);
    expect(p.value('dot.x')).toBe(1);
    expect(p.takeDirty().length).toBe(2);
  });
  it('overrides a state pose before clamping, on every step', () => {
    const r = load(
      doc(
        { 'dot.x': 'n' },
        {
          machine: {
            layers: { base: { initial: 'idle', states: { idle: { pose: { 'dot.x': 50 } } } } },
          },
        },
      ),
    );
    const p = new Player(r.model!);
    p.step(0);
    expect(p.value('dot.x')).toBe(0.25);
    p.set('n', 0.8);
    p.step(0.1);
    expect(p.value('dot.x')).toBe(0.8);
  });
  it('rejects legacy from/map attributes and requires both new attributes', () => {
    const root = '<anima version="0.1" name="binding" grid="20" requires="bind">';
    expect(
      compile(root + '<bind target="dot.x" from="n" map="identity"/></anima>').diagnostics,
    ).toContainEqual(expect.objectContaining({ code: 'unknown-attribute' }));
    expect(
      compile(root + '<bind/></anima>').diagnostics.filter((d) => d.code === 'missing-attribute'),
    ).toHaveLength(2);
  });
  it('compiles, decompiles and locates both spellings', () => {
    const src =
      '<anima version="0.1" name="bound" grid="20" requires="bind"><number name="n"/><circle id="dot" cx="10" cy="10" r="8" stroke="#000"/><bind target="dot.trimEnd" value="n"/></anima>';
    const r = compile(src);
    expect(r.diagnostics).toEqual([]);
    expect(r.doc?.bind).toEqual({ 'dot.stroke.trimEnd': 'n' });
    expect(compile(decompile(r.doc!)).doc).toEqual(r.doc);
    expect(compile(src.replace('value="n"', 'value="missing"')).diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unknown-input',
        line: 1,
        column: src.indexOf('value="n"') + 8,
      }),
    );
    expect(
      compile(
        src.replace('/></anima>', '/><bind target="dot.trimEnd" value="n"/></anima>'),
      ).diagnostics.some((d) => d.code === 'duplicate-name'),
    ).toBe(true);
  });
});
