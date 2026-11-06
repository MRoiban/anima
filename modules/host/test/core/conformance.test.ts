import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { player } from './fixture.ts';
it('host script conformance: subscription order, batching and callback writes', () => {
  const fixture = JSON.parse(
    readFileSync(new URL('../../conformance/subscriptions.json', import.meta.url), 'utf8'),
  );
  const p = player(),
    a = p.data;
  a.bind('main');
  const result: unknown[] = [];
  a.number('$score').on('change', (v) => {
    result.push(['score', v, a.get('$label'), p.value('dot.r')]);
    if (v === 7) a.number('$score').set(11);
  });
  a.string('$label').on('change', (v) =>
    result.push(['label', v, a.get('$score'), p.value('dot.r')]),
  );
  for (const op of fixture.script) {
    if (op.op === 'step') p.step(0);
    else
      a.batch(() => {
        for (const [key, value] of op.writes as [string, number | string][])
          if (key === 'score') a.number('$score').set(value as number);
          else a.string('$label').set(value as string);
      });
  }
  expect(result).toEqual(fixture.expected);
});
it('unsubscribes callbacks already scheduled for delivery, and ignores net-zero writes', () => {
  const p = player(),
    a = p.data;
  a.bind('main');
  const result: number[] = [];
  a.number('$score').on('change', () => off());
  const off = a.number('$score').on('change', (v) => result.push(v));
  a.batch(() => {
    a.number('$score').set(9);
    a.number('$score').set(4);
  });
  p.step(0);
  expect(result).toEqual([]);
  a.number('$score').set(7);
  p.step(0);
  expect(result).toEqual([]);
});
it('keeps callback writes busy for the next step and prohibits recursive stepping', () => {
  const p = player(),
    a = p.data;
  a.bind('main');
  const values: number[] = [];
  a.number('$score').on('change', (v) => {
    values.push(v);
    if (v === 7) {
      expect(() => p.step(0)).toThrow('subscription');
      a.number('$score').set(11);
    }
  });
  a.number('$score').set(7);
  expect(p.busy).toBe(true);
  expect(p.step(0).settled).toBe(false);
  expect(p.busy).toBe(true);
  p.step(0);
  expect(values).toEqual([7, 11]);
  p.step(0);
  expect(p.busy).toBe(false);
});
it('removes subscriptions when a list item disappears without interrupting the step', () => {
  const p = player(),
    a = p.data;
  a.bind('main');
  const values: unknown[] = [];
  a.number('$items.0.count').on('change', (v) => values.push(v));
  a.list('$items').set([]);
  expect(() => p.step(0)).not.toThrow();
  a.list('$items').set([{ count: 10 }]);
  p.step(0);
  expect(values).toEqual([]);
});
