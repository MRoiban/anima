// Guide conventions: every xml fence is a complete document, unless the preceding line is
// <!-- fragment -->. Fragments are root children, wrapped in the minimal anima below.
// <!-- invalid: name.animl --> introduces an intentionally bad complete document in a text
// fence. <!-- diagnostics: name.animl --> holds exact merged stdout/stderr from validate.
// Filenames are relative to the scratch cwd, so positions and output need no normalisation.
import { spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const guide = readFileSync(new URL('../../../docs/AUTHORING.md', import.meta.url), 'utf8');
const main = fileURLToPath(new URL('../src/main.ts', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'anima-authoring-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function cli(...args: string[]) {
  const transcript = join(scratch, 'transcript.txt');
  const fd = openSync(transcript, 'w');
  try {
    const result = spawnSync(process.execPath, [main, ...args], {
      cwd: scratch,
      stdio: ['ignore', fd, fd],
    });
    if (result.error) throw result.error;
    return { code: result.status, output: readFileSync(transcript, 'utf8') };
  } finally {
    closeSync(fd);
  }
}

const blocks = [...guide.matchAll(/(?:<!-- ([^\n]+) -->\n)?```(\w+)\n([\s\S]*?)\n```/g)].map(
  (m) => ({ marker: m[1], language: m[2]!, source: m[3]! + '\n' }),
);
const xml = blocks.filter((b) => b.language === 'xml');
const invalid = blocks.filter((b) => b.marker?.startsWith('invalid: '));
const diagnostics = blocks.filter((b) => b.marker?.startsWith('diagnostics: '));

describe('authoring guide executable examples', () => {
  it('finds examples and pairs every bad input with one diagnostic transcript', () => {
    expect(xml.length).toBeGreaterThan(0);
    expect(invalid.length).toBeGreaterThanOrEqual(6);
    expect(diagnostics.map((b) => b.marker!.slice('diagnostics: '.length)).sort()).toEqual(
      invalid.map((b) => b.marker!.slice('invalid: '.length)).sort(),
    );
    expect(new Set(invalid.map((b) => b.marker)).size).toBe(invalid.length);
  });

  it.each(xml.map((block, index) => ({ ...block, index })))(
    'xml block $index compiles with validate',
    ({ source, marker, index }) => {
      expect(marker === undefined || marker === 'fragment').toBe(true);
      const file = `example-${index}.animl`;
      writeFileSync(
        join(scratch, file),
        marker === 'fragment'
          ? `<anima version="0.1" name="example" grid="20">\n${source}</anima>\n`
          : source,
      );
      const result = cli('validate', file);
      expect(result.code, result.output).toBe(0);
      // Warnings indicate incomplete context or a stale example too.
      expect(result.output).toBe(`${file}: ok\n`);
    },
  );

  it.each(invalid.map((block) => ({ ...block, file: block.marker!.slice('invalid: '.length) })))(
    '$file produces the pasted diagnostics verbatim',
    ({ source, file }) => {
      writeFileSync(join(scratch, file), source);
      const result = cli('validate', file);
      expect(result.code, result.output).toBe(1);
      const expected = diagnostics.find((b) => b.marker === `diagnostics: ${file}`);
      expect(expected).toBeDefined();
      expect(result.output).toBe(expected!.source);
    },
  );

  it.each(['data', 'convert', 'host'])(
    'docs %s serves its chapter and data authoring link',
    (topic) => {
      const result = cli('docs', topic);
      expect(result.code, result.output).toBe(0);
      expect(result.output).toContain('## ' + topic);
      expect(result.output).toContain('Data: view models, `$` paths and converters');
      expect(result.output).toContain('docs/AUTHORING.md#data-view-models--paths-and-converters');
    },
  );

  it('exposes the forgotten pivot through inspect and rendered geometry', () => {
    const example = xml.find((b) => b.source.includes('name="pivot"'));
    expect(example).toBeDefined();
    writeFileSync(join(scratch, 'pivot.animl'), example!.source);
    const inspected = cli('inspect', 'pivot.animl');
    expect(inspected.code, inspected.output).toBe(0);
    expect(inspected.output).toContain('  dot (circle)\n');
    const rendered = cli('render', 'pivot.animl', '-o', 'pivot.svg');
    expect(rendered.code, rendered.output).toBe(0);
    const svg = readFileSync(join(scratch, 'pivot.svg'), 'utf8');
    expect(svg).toContain('matrix(0 1 -1 0 0 0)');
    expect(svg).toContain('<circle cx="10" cy="4"');
    // That matrix maps (10, 4) to (-4, 10), outside the default 20-unit box.
    writeFileSync(
      join(scratch, 'pivot.animl'),
      example!.source.replace('rotate="90"', 'pivot="10 4" rotate="90"'),
    );
    const fixed = cli('render', 'pivot.animl', '-o', 'fixed.svg');
    expect(fixed.code, fixed.output).toBe(0);
    expect(readFileSync(join(scratch, 'fixed.svg'), 'utf8')).toContain('matrix(0 1 -1 0 14 -6)');
  });

  it('compiles the HTML example at build time', () => {
    const html = blocks.filter((b) => b.language === 'html');
    expect(html.length).toBeGreaterThan(0);
    for (const [i, block] of html.entries()) {
      const file = `page-${i}.html`;
      const out = `page-${i}.built.html`;
      writeFileSync(join(scratch, file), block.source);
      const result = cli('build', file, '-o', out);
      expect(result.code, result.output).toBe(0);
      expect(readFileSync(join(scratch, out), 'utf8')).toContain('application/vnd.anima+json');
    }
  });
});

// Every explicit schema/docs topic in the guide is an executable interface promise.
const commands = [
  ...new Set(
    [...guide.matchAll(/\banima (schema|docs) ([a-z][a-z-]*)\b/g)].map((m) => `${m[1]} ${m[2]}`),
  ),
];
it.each(commands)('authoring command anima %s exists', (command) => {
  const result = cli(...command.split(' '));
  expect(result.code, result.output).toBe(0);
  expect(result.output.trim()).not.toBe('');
});
