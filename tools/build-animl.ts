import '@anima-format/core/all';
// Rebuild authored AniML through the package API, without invoking the CLI.
//   node tools/build-animl.ts [--check]
import { globSync, readFileSync, writeFileSync } from 'node:fs';
import { pendingReason } from './pending.ts';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@anima-format/markup';

const root = fileURLToPath(new URL('../', import.meta.url));
const check = process.argv.includes('--check');
const files = globSync(
  [
    'examples/**/*.animl',
    'modules/*/examples/**/*.animl',
    'spec/conformance/*/case.animl',
    'spec/draw-conformance/*/case.animl',
  ],
  {
    cwd: root,
  },
).sort();
const outputs: { file: string; text: string }[] = [];
for (const file of files) {
  const reason = pendingReason(dirname(root + file));
  if (reason) {
    console.log(`Pending ${file}: ${reason}`);
    continue;
  }
  const source = readFileSync(new URL(file, new URL('../', import.meta.url)), 'utf8');
  if (/^\s*<library\b/.test(source)) continue;
  const result = compile(source, {
    file,
    resolve: (path) => readFileSync(new URL(path, new URL('../', import.meta.url)), 'utf8'),
  });
  for (const d of result.diagnostics) {
    console.error(
      `${d.file ?? file}:${d.line ?? 1}:${d.column ?? 1}: ${d.severity} ${d.code} ${d.pointer}: ${d.message}${d.hint ? ` (${d.hint})` : ''}`,
    );
  }
  if (result.diagnostics.length || result.text === undefined) process.exitCode = 1;
  else outputs.push({ file: file.replace(/\.animl$/, '.ani'), text: result.text });
}

// Validate the whole corpus before writing any output.
if (!process.exitCode) {
  for (const { file, text } of outputs) {
    const out = new URL(file, new URL('../', import.meta.url));
    if (check) {
      let existing: string | undefined;
      try {
        existing = readFileSync(out, 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      if (existing !== text) {
        console.error(`${file} is stale: run npm run build:animl`);
        process.exitCode = 1;
      }
    } else writeFileSync(out, text);
  }
}
if (!process.exitCode) console.log(`${check ? 'Checked' : 'Built'} ${files.length} AniML files`);
