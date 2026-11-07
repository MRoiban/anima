import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile } from '../../../../../packages/markup/src/index.ts';
export function scene() {
  const file = resolve('modules/data/test/fixtures/bf1/theme.animl');
  const result = compile(readFileSync(file, 'utf8'), { file, resolve: (p) => readFileSync(p, 'utf8') });
  if (!result.doc) throw Error(JSON.stringify(result.diagnostics));
  return result.doc;
}
