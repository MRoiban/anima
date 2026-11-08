import { VERBOSE } from '@anima-format/core';
import { propertyNames } from '../../markup-hooks/markup/data.ts';
import { dataMarkup } from '../../data/markup/index.ts';
export function installArtboardMarkup(grammar: Pick<typeof dataMarkup, 'form'>): void {
  if (!propertyNames.includes('artboard')) propertyNames.push('artboard');
  const form = grammar.form;
  grammar.form = (el, base) =>
    form(el.name === 'artboard' ? { ...el, name: 'component' } : el, base);
}
if (VERBOSE) installArtboardMarkup(dataMarkup);
