import { describe, expect, it } from 'vitest';
import { ALIASES, suggest } from '../src/suggest.ts';

describe('CLI suggestions', () => {
  it.each([
    ['rendr', ['render'], ['render']],
    ['valdate', ['validate'], ['validate']],
    ['--sze', ['--size'], ['--size']],
    ['covr', ['cover'], ['cover']],
    ['examples', ['example'], ['example']],
    ['example', ['examples'], ['examples']],
  ])('suggests %s', (word, candidates, expected) => {
    expect(suggest(word, candidates)).toEqual(expected);
  });

  it('does not pad unrelated input with noise', () => {
    expect(suggest('xyz', ['render', 'validate', 'examples'])).toEqual([]);
  });

  it('maps the small command alias vocabulary to canonical commands', () => {
    expect(ALIASES).toMatchObject({
      check: 'validate',
      lint: 'validate',
      show: 'render',
      draw: 'render',
      find: 'search',
      grep: 'search',
      topics: 'docs',
    });
  });
});
