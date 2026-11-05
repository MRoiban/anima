import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';

const codes = [
  'markup-syntax',
  'unknown-element',
  'misplaced-element',
  'unknown-attribute',
  'missing-attribute',
  'duplicate-attribute',
  'duplicate-name',
  'bad-attribute',
  'bad-keyframe',
  'paint-attribute',
];
const dir = new URL('./invalid/', import.meta.url);
const fixtures = readdirSync(dir)
  .filter((f) => f.endsWith('.animl'))
  .map((file) => {
    const source = readFileSync(new URL(file, dir), 'utf8');
    const match = /^<!-- expect ([a-z-]+) at (\d+):(\d+) -->/.exec(source);
    if (!match) throw new Error(`${file}: missing expectation comment`);
    return { file, source, code: match[1]!, line: Number(match[2]), column: Number(match[3]) };
  });

describe('invalid AniML fixtures', () => {
  it('has a broken document for each of the ten §7 markup codes', () => {
    expect([...new Set(fixtures.map((f) => f.code))].sort()).toEqual([...codes].sort());
  });
  it.each(fixtures)('$file → $code at $line:$column', ({ file, source, code, line, column }) => {
    const result = compile(source, { file });
    expect(result.doc).toBeUndefined();
    expect(result.text).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        file,
        code,
        severity: 'error',
        line,
        column,
        pointer: expect.any(String),
        message: expect.any(String),
      }),
    );
  });
});
