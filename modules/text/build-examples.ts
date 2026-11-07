// Rebuild the text capability examples from the authored conformance sources.
import '@anima-format/core/all';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { compile, formatMarkup } from '@anima-format/markup';
for (const name of readdirSync('modules/text/capabilities')) {
  const base = 'modules/text/capabilities/' + name;
  let source = readFileSync('spec/conformance/' + name + '/case.animl', 'utf8');
  source = formatMarkup(source).text!;
  writeFileSync('spec/conformance/' + name + '/case.animl', source);
  const result = compile(source);
  if (!result.text || result.diagnostics.length) throw Error(JSON.stringify(result.diagnostics));
  writeFileSync(base + '/example.animl', source);
  writeFileSync(base + '/example.ani', result.text);
}
