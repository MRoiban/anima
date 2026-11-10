import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { compile } from '@anima-format/markup';
import { load } from '@anima-format/core';
import { run } from '../src/cli.ts';
import { doctor } from '../src/doctor.ts';
import { wiringSummary } from '../src/inspect-summary.ts';
import { LIGHT, sheetSVG } from '../src/render.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'anima-issues-51-54-56-'));
  dirs.push(dir);
  return dir;
};

const cli = async (...args: string[]) => {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out, err };
};

it('#51 counts list-component $parent reads while keeping genuine unused properties', () => {
  const { doc, diagnostics } = compile(
    readFileSync(resolve('design/issues/proof/51-parent.animl'), 'utf8'),
  );
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const loaded = load(doc!);
  expect(loaded.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect(
    wiringSummary(loaded.model!, loaded.diagnostics)
      .filter((d) => d.code === 'unused-property')
      .map((d) => d.pointer),
  ).toEqual(['/data/models/Board/properties/stroke']);
});

it('#54 new --glyph preserves a filled body and cut-out stroke through the import path', async () => {
  const dir = temp();
  const source = join(dir, 'cutout.svg');
  const out = join(dir, 'cutout.ani');
  writeFileSync(source, readFileSync(resolve('design/issues/proof/54-cutout.svg'), 'utf8'));
  const scaffold = await cli('new', 'cutout', '--glyph', source, '-o', out, '--force');
  expect(scaffold.code, scaffold.err.join('\n')).toBe(0);
  const compare = await cli('render', out, '--compare', source, '--format=json');
  expect(compare.code, compare.out.concat(compare.err).join('\n')).toBe(0);
  expect(JSON.parse(compare.out[0]!)).toMatchObject({
    pass: true,
    differingPixels: 0,
    maxChannelDifference: 0,
  });
});

it('#56 contact-sheet labels contrast with a dark custom background', () => {
  const svg = sheetSVG(
    [['t=0.000s', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>']],
    { ...LIGHT, background: '#111111' },
    24,
  );
  expect(svg).toContain('fill="#f0eee6">t=0.000s</text>');
});

it('#56 treats a missing Firefox as a doctor warning and names FIREFOX_PATH', async () => {
  const old = process.env.FIREFOX_PATH;
  process.env.FIREFOX_PATH = resolve(temp(), 'missing-firefox');
  try {
    const result = await doctor(temp());
    const firefox = result.checks.find((check) => check.name === 'firefox');
    expect(firefox).toMatchObject({ pass: false, severity: 'warning' });
    expect(firefox?.hint).toContain('FIREFOX_PATH');
    expect(
      result.checks
        .filter((check) => !check.pass && check.severity !== 'warning')
        .map((c) => c.name),
    ).not.toContain('firefox');
    expect(result.ok).toBe(
      result.checks.every((check) => check.pass || check.severity === 'warning'),
    );
  } finally {
    if (old === undefined) delete process.env.FIREFOX_PATH;
    else process.env.FIREFOX_PATH = old;
  }
}, 30000);

it('#56 session emits a snapshot once, in snapshots rather than output', async () => {
  const dir = temp();
  const file = join(dir, 'scene.animl');
  writeFileSync(file, readFileSync(resolve('design/issues/proof/56-sheet.animl'), 'utf8'));
  const out: string[] = [];
  async function* input() {
    yield 'snapshot --all';
    yield 'quit';
  }
  const code = await run(['session', file], {
    out: (s) => out.push(s),
    err: () => {},
    input: input(),
  });
  expect(code).toBe(0);
  const reply = JSON.parse(out[0]!);
  expect(reply.snapshots).toHaveLength(1);
  expect(reply.output).toEqual([]);
});
