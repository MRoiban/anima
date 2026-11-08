import { expect, it } from 'vitest';
import { run } from '../../../../packages/cli/src/cli.ts';
it('CLI validates, exposes schema spellings, types to filter all five labels, and reports accessible fields', async () => {
  let output = '',
    errors = '';
  const io = {
    out: (s: string) => {
      output += s + '\n';
    },
    err: (s: string) => {
      errors += s + '\n';
    },
  };
  const file = 'modules/text-input/examples/search-card.animl';
  expect(await run(['validate', file], io)).toBe(0);
  expect(errors).toBe('');
  output = '';
  expect(await run(['schema', 'text'], io)).toBe(0);
  expect(output).toContain('textInput');
  output = '';
  expect(
    await run(
      [
        'sample',
        file,
        '--font',
        'sans-serif=fixtures/fonts/anima-test.ttf',
        '--script',
        'modules/text-input/examples/search.txt',
      ],
      io,
    ),
  ).toBe(0);
  const snapshots = output
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  expect(snapshots[0].values).toMatchObject({
    $query: 'Pear',
    $count: 1,
    $summary: '1 results',
    'item0.collapsed': true,
    'item1.collapsed': false,
    'item2.collapsed': true,
    'item3.collapsed': true,
    'item4.collapsed': true,
  });
  expect(snapshots[1].values).toMatchObject({ $query: 'Apple', $count: 1 });
  expect(snapshots[1].semantics).toEqual([
    expect.objectContaining({
      id: 'search',
      role: 'text-field',
      label: 'Search fruit',
      value: 'Apple',
    }),
  ]);
}, 15000);
