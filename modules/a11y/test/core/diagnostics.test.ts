import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load } from '@anima-format/core';
import { compile } from '@anima-format/markup';
const raw = (a11y: object, requires = ['a11y']) => ({
  anima: '0.1',
  name: 'a11y-errors',
  grid: 20,
  requires,
  inputs: { n: { type: 'number' }, b: { type: 'bool' } },
  nodes: [{ id: 'node', type: 'group', a11y }],
});
it.each([
  [{ role: 'checkbox', checked: 'missing' }, 'unknown-input', 'checked'],
  [{ role: 'checkbox', checked: 'n' }, 'input-type', 'checked'],
  [{ role: 'button', activate: 'n' }, 'input-type', 'activate'],
  [{ role: 'heading', level: 7 }, 'bad-value', 'level'],
  [{ role: 'text', href: '/help' }, 'bad-value', 'href'],
  [{ role: 'text', checkedMixed: true }, 'bad-value', 'checkedMixed'],
  [{ role: 'slider', value: 'n', min: 10, max: 10 }, 'bad-value', 'min'],
  [{ role: 'slider', value: 'b' }, 'input-type', 'value'],
  [{ role: 'slider' }, 'bad-value', 'value'],
  [{ role: 'text', pressed: false }, 'a11y-role-state', 'pressed'],
  [{ role: 'button', label: '$title' }, 'undeclared-feature', 'label'],
] as const)('diagnoses %j as %s at its JSON pointer', (a11y, code, key) => {
  const result = load(raw(a11y));
  expect(result.model).toBeUndefined();
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code,
      pointer: '/nodes/0/a11y/' + key,
      message: expect.any(String),
      ...(code === 'bad-value' && key === 'level' ? {} : { hint: expect.any(String) }),
    }),
  );
  if (code === 'a11y-role-state')
    expect(result.diagnostics.find((d) => d.code === code)?.hint).toContain('allowed states:');
});
it('requires node semantics to be declared, and rejects non-Anima role names', () => {
  expect(load(raw({ role: 'button' }, [])).diagnostics).toContainEqual(
    expect.objectContaining({ code: 'undeclared-feature', pointer: '/nodes/0/a11y' }),
  );
  for (const role of ['radioButton', 'tabList', 'alertDialog', 'listItem'])
    expect(load(raw({ role })).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'bad-value', pointer: '/nodes/0/a11y/role' }),
    );
});
it('maps an AniML role/state diagnostic to the authored field', () => {
  const result = compile(
    '<anima version="0.1" name="bad" grid="20" requires="a11y"><group id="n"><a11y role="text" pressed="false"/></group></anima>',
  );
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'a11y-role-state',
      pointer: '/nodes/0/a11y/pressed',
      line: 1,
      column: expect.any(Number),
      hint: expect.stringContaining('allowed states:'),
    }),
  );
});
it.each([
  ['missing', 'unknown-input'],
  ['b', 'input-type'],
] as const)('[P3b-9] diagnoses heading level binding %s', (level, code) => {
  const result = load(raw({ role: 'heading', level }));
  expect(result.model).toBeUndefined();
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code,
      pointer: '/nodes/0/a11y/level',
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});
