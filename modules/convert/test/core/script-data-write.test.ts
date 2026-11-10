// Issue #53: a script data write takes effect when written, so one advance moves a converted glide.
import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { load, runScript } from '@anima-format/core';
import { compile } from '@anima-format/markup';

const model = load(
  compile(
    readFileSync(
      new URL('../../../../design/issues/proof/53-glide.animl', import.meta.url),
      'utf8',
    ),
  ).doc!,
).model!;
const values = (script: string) =>
  (runScript(model, script).output.at(-1) as { values: Record<string, number> }).values;

it('runs a glide from the data write over one advance', () => {
  expect(values('data set $view 10\nadvance 1\nsnapshot $sview')['$sview']).toBe(10);
  expect(values('data set $view 10\nadvance 0.225\nsnapshot $sview')['$sview']).toBeCloseTo(5, 9);
});

it('keeps explicit zero-length steps meaning the same', () => {
  expect(values('data set $view 10\nadvance 0\nadvance 1\nsnapshot $sview')['$sview']).toBe(10);
});
