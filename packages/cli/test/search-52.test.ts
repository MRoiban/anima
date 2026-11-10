// Issue #52: search answers real questions and returns nothing for words Anima doesn't have.
import { expect, it } from 'vitest';
import { search } from '../src/discover/api.ts';
import { suggest } from '../src/suggest.ts';

const top = (query: string, n = 3) => search(query, { limit: n }).map((hit) => hit.entry.name);

it('finds $parent for reading a parent value from a list item', () => {
  expect(top('list item read parent value')).toContain('$parent.<property>');
}, 30000);

it('finds the page API list operations for replacing an item', () => {
  expect(top('replace one list item', 5)).toContain('list.remove');
  expect(top('insert item into a list from javascript')).toContain('list.insert');
}, 30000);

it('returns nothing for a word Anima has no entry for', () => {
  expect(search('squircle')).toEqual([]);
}, 30000);

it('does not let a one-letter candidate prefix-match a long word', () => {
  expect(suggest('squircle', ['s', 'o', 'sample'])).toEqual([]);
  expect(suggest('renderx', ['render', 'sample'])).toEqual(['render']);
});
