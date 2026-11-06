import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { dataState } from '../../../data/core/index.ts';
import { player } from './fixture.ts';
it('independent host-edit script conformance and storage identity', () => {
  const fixture = JSON.parse(
    readFileSync(new URL('../../conformance/list-edits.json', import.meta.url), 'utf8'),
  );
  const p = player(),
    list = p.data.list('items'),
    item = list.at(0);
  const storage = dataState(p)!.instances.main!.items;
  const named = dataState(p)!.instances.named;
  for (const op of fixture.script) {
    if (op.op === 'add') list.add(op.count === undefined ? undefined : { count: op.count });
    else if (op.op === 'insert') list.insert(op.index, { count: op.count });
    else if (op.op === 'swap') list.swap(op.a, op.b);
    else if (op.op === 'remove') list.remove(op.index);
    else if (op.op === 'nested') item.number('count').set(op.count);
    else if (op.op === 'remove-item') list.remove(item);
    else {
      p.step(0);
      expect(list.value.map((v) => (v as { count: number }).count)).toEqual(op.expected);
      expect(dataState(p)!.instances.main!.items).toBe(storage);
      expect((storage as object[])[1]).toBe(named);
    }
  }
});
