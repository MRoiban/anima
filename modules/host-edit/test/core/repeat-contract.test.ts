import { expect, it } from 'vitest';
import { player } from './fixture.ts';
import { listState } from '../../../lists/core/index.ts';
import { repeatContract, repeatDocument, repeatExpected } from '../contracts.ts';
it('player.data list edits retain repeat item players and a running timeline, with independent expectations', () => {
  const p = player(repeatDocument());
  expect(
    repeatContract(p, p.data, () => listState(p)!.runs[0]!.items.map((i) => i.player)),
  ).toEqual(repeatExpected);
});
