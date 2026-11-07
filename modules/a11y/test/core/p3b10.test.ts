import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { load, Player, runScript } from '@anima-format/core';
import { compile, decompile } from '@anima-format/markup';

it('[P3b-10a] keeps a derived spoken slider value separate from its number in both syntaxes', () => {
  const source = readFileSync(
    new URL('../../examples/slider-value-text.animl', import.meta.url),
    'utf8',
  );
  const result = compile(source);
  expect(result.diagnostics).toEqual([]);
  const p = new Player(load(result.doc!).model!);
  p.step(0);
  expect(p.semantics()[0]).toMatchObject({ value: 40, valueText: 'Volume 40 %' });
  p.semanticAction('volume', 'increase');
  p.step(0);
  expect(p.semantics()[0]).toMatchObject({ value: 45, valueText: 'Volume 45 %' });
  expect(compile(decompile(result.doc!)).doc).toEqual(result.doc);
});

const keyDoc = (input: boolean) =>
  load({
    anima: '0.1',
    name: 'keys',
    grid: 20,
    requires: ['a11y', 'focus', ...(input ? ['input'] : [])],
    inputs: { volume: { type: 'number', default: 40 }, on: { type: 'bool' } },
    nodes: [
      { id: 'volume', type: 'group', a11y: { role: 'slider', value: 'volume', step: 5 } },
      ...['button', 'switch', 'checkbox', 'radio', 'link'].map((role) => ({
        id: role,
        type: 'group',
        a11y: {
          role,
          activate: 'on',
          ...(role === 'button'
            ? { pressed: 'on' }
            : ['switch', 'checkbox', 'radio'].includes(role)
              ? { checked: 'on' }
              : {}),
          ...(role === 'link' ? { href: '/help' } : {}),
        },
      })),
      {
        id: 'tabs',
        type: 'group',
        a11y: { role: 'tab-list' },
        children: [
          { id: 't1', type: 'group', a11y: { role: 'tab' } },
          { id: 'skip', type: 'group', a11y: { role: 'tab', disabled: true } },
          { id: 't2', type: 'group', a11y: { role: 'tab' } },
        ],
      },
    ],
  }).model!;

it.each([false, true])(
  '[P3b-10a] headless semantic keys mirror native controls (input=%s)',
  (input) => {
    const result = runScript(
      keyDoc(input),
      `semantic volume focus
key down ArrowRight
key up ArrowRight
semantics volume
key down ArrowUp
key down ArrowLeft
key down ArrowDown
semantics volume
key down End
semantics volume
key down Home
semantics volume
semantic button focus
key down Space
semantics button
key up Space
expect on == true
semantic switch focus
key down Enter
expect on == false
semantic checkbox focus
key down Space
key up Space
expect on == true
semantic radio focus
key down Space
key up Space
expect on == true
semantic link focus
key down Enter
expect on == false
semantic t1 focus
key down ArrowRight
semantics tabs
key down Home
key down End
key down ArrowRight
semantics tabs`,
    );
    const output = result.output as {
      value?: number;
      children?: { id: string; states: { focused?: boolean } }[];
    }[];
    expect(output.slice(0, 4).map((n) => n.value)).toEqual([45, 40, 100, 0]);
    expect(output[5]!.children?.filter((n) => n.states.focused).map((n) => n.id)).toEqual(['t2']);
    expect(output[6]!.children?.filter((n) => n.states.focused).map((n) => n.id)).toEqual(['t1']);
  },
);

it.each([
  [{ role: 'button', valueText: 'spoken' }, 'bad-value'],
  [{ role: 'slider', value: 'n', valueText: '$missing' }, 'undeclared-feature'],
  [{ role: 'slider', value: 'n', valueText: 'n' }, 'input-type'],
])('[P3b-10a] diagnoses valueText at its own JSON pointer', (a11y, code) => {
  const result = load({
    anima: '0.1',
    name: 'invalid',
    grid: 20,
    requires: ['a11y'],
    inputs: { n: { type: 'number' } },
    nodes: [{ id: 'n', type: 'group', a11y }],
  });
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code,
      pointer: '/nodes/0/a11y/valueText',
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});

it.each([false, true])(
  '[P3b-10a] composes queued range actions and reports narrower limits (data=%s)',
  (data) => {
    const declaration = data
      ? '<model name="M"><number name="n" default="40" min="20" max="50"/></model><instance name="main" model="M" default="true"/>'
      : '<number name="n" default="40" min="20" max="50"/>';
    const key = data ? '$n' : 'n';
    const r = compile(
      `<anima version="0.1" name="range" grid="20" requires="a11y ${data ? 'data' : ''}">${declaration}<group id="slider"><a11y role="slider" value="${key}" min="0" max="100" step="5"/></group></anima>`,
    );
    expect(r.diagnostics).toEqual([]);
    const p = new Player(load(r.doc!).model!);
    expect(p.semanticAction('slider', 'increase')).toBe(true);
    expect(p.semanticAction('slider', 'increase')).toBe(true);
    expect(p.semanticAction('slider', 'increase')).toBe(false);
    p.step(0);
    expect(p.get(key)).toBe(50);
    expect(p.semanticAction('slider', 'increase')).toBe(false);
    expect(p.semanticAction('slider', 'decrease')).toBe(true);
    p.set(key, 30);
    expect(p.semanticAction('slider', 'decrease')).toBe(true);
    p.step(0);
    expect(p.get(key)).toBe(25);
    p.set(key, 20);
    p.step(0);
    expect(p.semanticAction('slider', 'decrease')).toBe(false);
  },
);
it('[P3b-10a] maps value-text diagnostics back to AniML and validates unknown data paths', () => {
  const markup = compile(
    '<anima version="0.1" name="invalid" grid="20" requires="a11y"><group id="n"><a11y role="button" value-text="Spoken"/></group></anima>',
  );
  expect(markup.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'bad-value',
      pointer: '/nodes/0/a11y/valueText',
      line: 1,
      column: expect.any(Number),
      hint: expect.any(String),
    }),
  );
  const result = compile(
    '<anima version="0.1" name="invalid" grid="20" requires="a11y data"><model name="M"><number name="n"/></model><instance name="main" model="M" default="true"/><group id="n"><a11y role="slider" value="$n" value-text="$missing"/></group></anima>',
  );
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'unknown-input',
      pointer: '/nodes/0/a11y/valueText',
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});

it('[P3b-10a] ignores nonnative button arrows and unarmed Space releases', () => {
  const r = runScript(
    keyDoc(true),
    'semantic button focus\nkey down ArrowRight\nkey up Space\nexpect on == false\nsemantics button',
  );
  expect(r.output).toEqual([
    expect.objectContaining({ id: 'button', states: { pressed: false, focused: true } }),
  ]);
});
