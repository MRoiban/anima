import { afterAll, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { run } from '../src/cli.ts';
import { NODE_TYPES, nodeShape } from '@anima-format/core';

const scratch = mkdtempSync(resolve(tmpdir(), 'anima-p6-12-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
async function invoke(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, text: out.join('\n'), err: err.join('\n') };
}

it.each(['schema', 'docs'])('%s resolves camelCase and suggests near misses', async (cmd) => {
  const canonical = await invoke(cmd, 'text-input');
  expect(canonical.code, canonical.err).toBe(0);
  expect(await invoke(cmd, 'textInput')).toEqual(canonical);
  const typo = await invoke(cmd, 'text-inpt');
  expect(typo.code).toBe(2);
  expect(typo.err).toContain('did you mean "text-input"');
  expect((await invoke(cmd, 'zzzzzzzzzz')).code).toBe(2);
});

it('resolves schema aliases with field lookup and filters', async () => {
  expect(await invoke('schema', 'textInput.placeholder')).toEqual(
    await invoke('schema', 'text-input.placeholder'),
  );
  expect(await invoke('schema', 'textInput', '--bindable', '--format=json')).toEqual(
    await invoke('schema', 'text-input', '--bindable', '--format=json'),
  );
});

it('marks required fields for every node in text and JSON output', async () => {
  for (const type of NODE_TYPES) {
    const text = await invoke('schema', type);
    const json = JSON.parse((await invoke('schema', type, '--format=json')).text);
    for (const key of nodeShape(type).req ?? []) {
      const field = json.fields.find((f: { ani: string }) => f.ani === key);
      expect(field, type + '.' + key).toMatchObject({ required: true });
      expect(text.text, type + '.' + key).toContain(
        `${field.markup} ↔ ${key}: ${field.type} (required)`,
      );
    }
  }
  expect((await invoke('schema', 'rect')).text).toContain('x0 ↔ x0: number (required)');
});

it('defaults to contents and serves sections on request', async () => {
  const result = await invoke('docs');
  expect(result.code).toBe(0);
  expect(result.text).toContain('Contents (anima docs authoring <section>)');
  expect(result.text).not.toContain('```');
  expect(result.text.length).toBeLessThan(readFileSync('docs/AUTHORING.md', 'utf8').length / 2);
  const slug = /^- ([\w-]+):/m.exec(result.text)![1]!;
  expect((await invoke('docs', 'authoring', slug)).text).toMatch(/^## /);
});

it('hints at viewBox when grid is given a pair', async () => {
  const file = resolve(scratch, 'grid.animl');
  writeFileSync(file, '<anima version="0.1" name="grid" grid="40 30"/>');
  const result = await invoke('validate', file, '--format=json');
  expect(result.code).toBe(1);
  const diagnostics = JSON.parse(result.text).diagnostics;
  expect(diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'bad-attribute',
      pointer: '/grid',
      message: expect.any(String),
      hint: 'grid is one number (units per side); use viewBox="0 0 40 30" for a rectangular scene',
    }),
  );
});

it.each(['text', 'text-effects', 'text-input', 'fonts', 'bind'])(
  'validates every embedded and listed AniML example in served %s docs',
  async (topic) => {
    const docs = await invoke('docs', topic);
    expect(docs.code, docs.err).toBe(0);
    const sources = [...docs.text.matchAll(/```(?:xml|animl)\n([\s\S]*?)\n```/g)];
    const files = new Set([...docs.text.matchAll(/modules\/[\w/-]+\.animl/g)].map((m) => m[0]));
    expect(docs.text.length).toBeGreaterThan(0);
    for (const [index, match] of sources.entries()) {
      const file = resolve(scratch, `${topic}-${index}.animl`);
      writeFileSync(file, match[1]!);
      files.add(file);
    }
    for (const file of files) {
      const result = await invoke(
        'validate',
        file,
        '--font',
        'sans-serif=fixtures/fonts/anima-test.ttf',
        '--format=json',
      );
      expect(result.code, file + '\n' + result.text + result.err).toBe(0);
    }
  },
  30000,
);

it('serves the substring recipe and precise remaining bounds work', async () => {
  expect((await invoke('docs', '--list')).text).toContain('text-input');
  expect((await invoke('docs', 'text-input')).text).toContain(
    'contains(lower($label0), lower($query))',
  );
  expect((await invoke('docs', 'a11y')).text).toContain('exact painted path and stroke extents');
});
