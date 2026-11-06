import { expect, it } from 'vitest';
import { registerModule } from '@anima-format/core';
import { compile, decompile } from '../src/index.ts';
registerModule({
  name: 'testfields',
  entries: ['state', 'transition', 'layer', 'timeline', 'listener'].map((target) => ({
    target,
    shapes: {
      extension: { k: 'num', markup: 'test-value' },
      options: { k: 'obj', p: { ok: { k: 'bool' } } },
      keys: { k: 'arr', of: { k: 'str' } },
      scalar: { k: 'alt', of: [{ k: 'num' }, { k: 'str' }] },
    },
  })),
});
const source = `<anima version="0.1" name="fields" grid="20" requires="testfields">
  <bool name="go"/>
  <circle id="dot" cx="0" cy="0" r="1" fill="#000"/>
  <timeline name="t" duration="1" test-value="1" options='{"ok":true}'/>
  <layer name="l" initial="a" test-value="2"><state name="a" test-value="3"><on when="go" to="b" test-value="4"/></state><state name="b"/></layer>
  <listener on="click" toggle="go" test-value="5" keys='["ArrowLeft","Space"]' scalar='"custom"'/>
</anima>`;
it('registry fields and aliases on five element types survive compile → decompile → compile', () => {
  const a = compile(source);
  expect(a.diagnostics).toEqual([]);
  const xml = decompile(a.doc!);
  expect(xml).toContain('test-value="5"');
  expect(xml).toContain('options=');
  const b = compile(xml);
  expect(b.diagnostics).toEqual([]);
  expect(b.doc).toEqual(a.doc);
});
it('unknown fields and JSON spellings of aliased fields remain unknown attributes', () => {
  for (const attr of ['nonesuch', 'extension']) {
    const result = compile(source.replace('test-value="3"', `${attr}="3"`));
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'unknown-attribute', pointer: '/machine/layers/l/states/a' }),
    );
  }
});
it('malformed compound attributes report a positioned diagnostic', () => {
  const result = compile(source.replace('{"ok":true}', '{bad}'));
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code: 'bad-attribute', pointer: '/timelines/t/options', line: 4 }),
  );
});

it('late registration preserves earlier layer/listener contributions and updates attribute aliases', () => {
  registerModule({
    name: 'laterfields',
    entries: [{ target: 'listener', shapes: { extraFlag: { k: 'bool', markup: 'extra-flag' } } }],
  });
  const c = compile(
    source
      .replace('requires="testfields"', 'requires="testfields laterfields"')
      .replace('test-value="5"', 'test-value="5" extra-flag="true"'),
  );
  expect(c.diagnostics).toEqual([]);
  const xml = decompile(c.doc!);
  expect(xml).toContain('extra-flag="true"');
  expect(compile(xml).doc).toEqual(c.doc);
});
