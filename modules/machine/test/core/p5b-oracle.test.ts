import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { compile } from '../../../../packages/markup/src/index.ts';
import { load, Player } from '../../../../packages/core/src/index.ts';
const read = (kind: string, frame: string) => {
  const raw = JSON.parse(
    readFileSync(new URL(`../../oracle/p5b/${kind}/${frame}.json`, import.meta.url), 'utf8'),
  );
  return raw.viewModel.properties.find((p: { name: string }) => p.name === 'result').value;
};
it.each(['boolean', 'string', 'color', 'enum', 'trigger'])(
  'native %s guard: three exact transition observations',
  (kind) => {
    const source = readFileSync(
      new URL(
        `../../../../spec/conformance/state-machine-literal-${kind}/case.animl`,
        import.meta.url,
      ),
      'utf8',
    );
    const p = new Player(load(compile(source).doc!).model!);
    p.step(1 / 60);
    expect(p.value('dot.r')).toBe(read(kind, 'initial'));
    if (kind === 'trigger') p.fire('$value');
    else p.set('$value', kind === 'boolean' ? true : kind === 'color' ? '#d97757' : 'happy');
    p.step(1 / 60);
    expect(p.value('dot.r')).toBe(read(kind, 'changed'));
    p.step(1 / 60);
    expect(p.value('dot.r')).toBe(read(kind, 'held'));
  },
);
it('native asset-id equality transitions on the same typed asset reference', () => {
  const source = readFileSync(
    new URL('../../../../spec/conformance/state-machine-literal-asset/case.animl', import.meta.url),
    'utf8',
  );
  const raw = compile(source).doc! as {
    data: { models: { Root: { properties: { value: { default?: string } } } } };
  };
  raw.data.models.Root.properties.value.default = 'photo';
  const p = new Player(load(raw).model!);
  p.step(1 / 60);
  expect(p.value('dot.r')).toBe(read('asset', 'initial'));
  p.step(1 / 60);
  expect(p.value('dot.r')).toBe(read('asset', 'held'));
});
