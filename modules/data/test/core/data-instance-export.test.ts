import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { compile } from '../../../../packages/markup/src/index.ts';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { dataState } from '../../core/index.ts';
it('export discovery lists an exported authored instance and preserves private internal paths', () => {
  const r = compile(
    readFileSync(
      new URL('../../../../spec/conformance/data-instance-export/case.animl', import.meta.url),
      'utf8',
    ),
  );
  const p = new Player(load(r.doc!).model!);
  expect(dataState(p)!.exports()).toEqual([{ name: 'public', model: 'Root' }]);
  expect(p.get('$private:value')).toBe(4);
});
