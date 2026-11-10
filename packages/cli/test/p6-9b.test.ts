// seam(P6-9b): end-to-end regressions for the three reported benchmark failures.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { run } from '../src/cli.ts';

const source = `<anima version="0.1" name="shorthand" grid="20" requires="text data a11y"
 data='{"models":{"Main":{"properties":{"title":{"type":"string","default":"Old"}}}}}'>
 <text id="title" x="1" y="1"><a11y role="text" label="$title"/>
 <style id="s" font="Anima Test" size="2"/><run style="s" text="$title"/></text>
</anima>`;
const renamed = 'semantics; set $title "Changed"; advance 0; semantics';
const literal = source.replaceAll('$title', 'Changed');
async function invoke(args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out, err };
}
it('sample, tool outlines, browser-text SVG and PNG all follow run shorthand after semantic layout', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'anima-text-binding-'));
  try {
    const file = join(dir, 'case.animl'),
      control = join(dir, 'literal.animl');
    writeFileSync(file, source);
    writeFileSync(control, literal);
    const font = ['--font', 'Anima Test=' + resolve('fixtures/fonts/anima-test.ttf')];
    const sample = await invoke(['sample', file, ...font, '-e', renamed]);
    expect(sample.code, sample.err.join('\n')).toBe(0);
    expect(sample.out.map((s) => JSON.parse(s)[0].label)).toEqual(['Old', 'Changed']);
    for (const browser of [false, true]) {
      for (const extension of ['svg', 'png']) {
        const output = join(dir, `actual-${browser}.${extension}`),
          expected = join(dir, `expected-${browser}.${extension}`);
        const flags = browser ? ['--browser-text'] : [];
        const actual = await invoke([
          'render',
          file,
          ...font,
          ...flags,
          '-e',
          renamed,
          '-o',
          output,
        ]);
        const reference = await invoke(['render', control, ...font, ...flags, '-o', expected]);
        expect(actual.code, actual.err.join('\n')).toBe(0);
        expect(reference.code, reference.err.join('\n')).toBe(0);
        expect(readFileSync(output)).toEqual(readFileSync(expected));
        if (browser && extension === 'svg')
          expect(readFileSync(output, 'utf8')).toContain('>Changed</tspan>');
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 30000);
it('semantic sampling preserves a font-specific code, script pointer and font override hint', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'anima-missing-font-'));
  try {
    const file = join(dir, 'case.animl');
    writeFileSync(file, source);
    const result = await invoke(['sample', file, '-e', 'semantics']);
    expect(result.code).toBe(2);
    expect(result.err).toHaveLength(1);
    expect(JSON.parse(result.err[0]!)).toMatchObject({
      code: 'font-missing',
      pointer: '/script/0',
      message: expect.stringContaining('Anima Test'),
      hint: expect.stringContaining('--font Name=path'),
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it('help and docs describe local fonts for every command that installs them', async () => {
  for (const command of [
    'sample',
    'session',
    'bench',
    'inspect',
    'validate',
    'render',
    'flatten',
    'build',
  ]) {
    const help = (await invoke(['help', command])).out.join('\n');
    expect(help).toContain('--font');
  }
  expect((await invoke(['docs'])).out.join('\n')).toContain('Contents');
  for (const topic of [['authoring'], ['text']]) {
    const docs = await invoke(['docs', ...topic]);
    expect(docs.code).toBe(0);
    expect(docs.out.join('\n')).toContain('--font');
  }
});

it('session installs explicit fonts at startup and reloads changed document font assets', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'anima-font-session-'));
  try {
    const file = join(dir, 'case.animl');
    writeFileSync(file, source);
    const out: string[] = [],
      err: string[] = [];
    async function* input() {
      yield 'semantics';
      yield 'set $title "Changed"';
      yield 'advance 0';
      yield 'semantics';
      // Reload changes the requested family and adds the matching asset, with no CLI override.
      writeFileSync(
        file,
        source
          .replace('requires="text data a11y"', 'requires="text data a11y assets fonts"')
          .replace('font="Anima Test"', 'font="reloaded"')
          .replace(
            '<text id=',
            '<asset name="reloaded" type="font" src="' +
              resolve('fixtures/fonts/anima-test.ttf') +
              '"/><text id=',
          ),
      );
      yield 'reload';
      yield 'semantics';
      yield 'quit';
    }
    expect(
      await run(
        ['session', file, '--font', 'Anima Test=' + resolve('fixtures/fonts/anima-test.ttf')],
        { out: (s) => out.push(s), err: (s) => err.push(s), input: input() },
      ),
    ).toBe(0);
    expect(err).toEqual([]);
    const replies = out.map((s) => JSON.parse(s));
    expect(
      replies.every((r) => r.ok),
      JSON.stringify(replies),
    ).toBe(true);
    expect([
      replies[0].output[0][0].label,
      replies[3].output[0][0].label,
      replies[5].output[0][0].label,
    ]).toEqual(['Old', 'Changed', 'Changed']);
    expect(replies[4].reloaded).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it.each(['inspect', 'bench'])(
  '%s installs local fonts before stepping semantic text',
  async (cmd) => {
    const dir = mkdtempSync(join(tmpdir(), 'anima-font-command-'));
    try {
      const file = join(dir, 'case.animl');
      writeFileSync(file, source);
      const result = await invoke([
        cmd,
        file,
        '--font',
        'Anima Test=' + resolve('fixtures/fonts/anima-test.ttf'),
        ...(cmd === 'bench' ? ['--frames', '1'] : []),
      ]);
      expect(result.code, result.err.join('\n')).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
