import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { convertValue } from '../../core/index.ts';
import { compile } from '../../../../packages/markup/src/index.ts';
import { load, Player } from '../../../../packages/core/src/index.ts';
const read = (folder: string, name: string) =>
  JSON.parse(readFileSync(new URL(`../../oracle/${folder}/${name}.json`, import.meta.url), 'utf8'))
    .viewModel.properties;
it.each(['red', 'green', 'blue', 'white', 'black', 'grey', 'accent'])(
  'native component/HSL formatting: %s exact',
  (name) => {
    const props = read('p5b-color', name);
    const argb = props.find((p: { name: string }) => p.name === 'value').value;
    const rgba = '#' + argb.slice(2) + argb.slice(0, 2);
    expect(convertValue('color-format', rgba, { pattern: '{r} {g} {b} {a} {h} {s} {l}' })).toBe(
      props.find((p: { name: string }) => p.name === 'result').value,
    );
  },
);
it('native trigger converter: changed/same/changed integers deliver exactly two occurrences', () => {
  const source = readFileSync(
    new URL('../../../../spec/conformance/data-converter-trigger/case.animl', import.meta.url),
    'utf8',
  );
  const p = new Player(load(compile(source).doc!).model!);
  for (const [frame, value] of [
    ['initial', 0],
    ['changed', 1],
    ['same', 1],
    ['again', 2],
  ] as const) {
    p.set('$value', value);
    p.step(1 / 60);
    p.step(0);
    expect(p.value('dot.r')).toBe(
      read('p5b-trigger', frame).find((p: { name: string }) => p.name === 'result').value,
    );
  }
});

it('native trigger conversion establishes a nonzero initial baseline without a pulse', () => {
  const source = readFileSync(
    new URL('../../../../spec/conformance/data-converter-trigger/case.animl', import.meta.url),
    'utf8',
  );
  const raw = compile(source).doc! as {
    data: { models: { Root: { properties: { value: { default?: number } } } } };
  };
  raw.data.models.Root.properties.value.default = 2;
  const p = new Player(load(raw).model!);
  for (const frame of ['initial', 'held']) {
    p.step(1 / 60);
    p.step(0);
    expect(p.value('dot.r')).toBe(
      read('p5b-trigger-initial-nonzero', frame).find((p: { name: string }) => p.name === 'result')
        .value,
    );
  }
});
