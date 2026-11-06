import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { convertValue } from '../../core/index.ts';
import type { ConverterValue, ConverterOptions } from '../../core/index.ts';
const read = (file: string) =>
  JSON.parse(readFileSync(new URL('../../oracle/' + file, import.meta.url), 'utf8'));
const inputs = read('inputs.json') as {
  name: string;
  type: string;
  input: ConverterValue;
  options: ConverterOptions;
}[];
const outputs = new Map<string, ConverterValue>(
  read('observed.json').viewModel.properties.map((p: { name: string; value: ConverterValue }) => [
    p.name,
    p.value,
  ]),
);
it.each(inputs)('Rive data-dump observation: $name', (c) => {
  const actual = convertValue(c.type, c.input, c.options, {
    player: {},
    time: 0,
    state: new Map(),
  });
  const expected = outputs.get(c.name);
  expect(expected).toBeDefined();
  if (typeof expected === 'number') expect(actual).toBeCloseTo(expected, 5);
  else expect(actual).toEqual(expected);
});
