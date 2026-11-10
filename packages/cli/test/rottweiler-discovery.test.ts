// Rottweiler review of the CLI discovery work (design/rottweiler/DISCOVERY-LEDGER.md), round 1.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { run } from '../src/cli.ts';
import { completion } from '../src/completion.ts';
import { search } from '../src/discover/api.ts';

async function invoke(...args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(args, {
    out: (text) => out.push(text),
    err: (text) => err.push(text),
    write: (text) => out.push(text),
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

describe('discovery review round 1', () => {
  it('R1-1: options before the command still work, as on main', async () => {
    expect((await invoke('--summary', 'inspect', 'examples/bell.ani')).code).toBe(0);
    expect((await invoke('-e', 'snapshot', 'sample', 'examples/bell.ani')).code).toBe(0);
    const bad = await invoke('--frobnicate', 'inspect', 'examples/bell.ani');
    expect(bad.code).toBe(2);
  }, 30000);

  it('R1-2: a bone-chain pointer query finds inverse kinematics', () => {
    const names = search('make a bone chain follow the pointer', { limit: 5 }).map(
      (hit) => hit.entry.name,
    );
    expect(names).toContain('ik');
  }, 30000);

  it('R1-3: a docs section word narrows the page, and unknown sections miss', async () => {
    const whole = await invoke('docs', 'a11y');
    const part = await invoke('docs', 'a11y', 'painted-geometric-bounds-p7-8');
    expect(part.code).toBe(0);
    expect(part.out).toMatch(/Painted geometric bounds/);
    expect(part.out.length).toBeLessThan(whole.out.length / 2);
    expect((await invoke('docs', 'a11y', 'definitely-not-a-section')).code).toBe(2);
  }, 30000);

  it('R1-4: schema and docs misses are JSON under --format=json', async () => {
    for (const args of [
      ['schema', 'textInpt'],
      ['docs', 'ikx'],
      ['schema', 'rect.nope'],
    ]) {
      const result = await invoke(...args, '--format=json');
      expect(result.code).toBe(2);
      const error = JSON.parse(result.err) as { error: string; suggestions: string[] };
      expect(error.error).toMatch(/no (schema|docs) topic|unknown schema field/);
    }
  }, 30000);

  it('R1-5: the documented `examples bell --print` prints the AniML source', async () => {
    const result = await invoke('examples', 'bell', '--print');
    expect(result.code).toBe(0);
    expect(result.out).toMatch(/<anima /);
  }, 30000);

  it('R1-6: an invalid global --format is a usage error even without a command', async () => {
    expect((await invoke('--format=bogus')).code).toBe(2);
    expect((await invoke('--format', 'bogus')).code).toBe(2);
  });

  it('R1-7: fish completes command aliases like their command', () => {
    const fish = completion('fish');
    expect(fish).toMatch(/__fish_use_subcommand' -a 'check'/);
    expect(fish).toMatch(/__fish_seen_subcommand_from validate check lint' -l font/);
  });

  it('R1-8: the CLI package ships its llms.txt', () => {
    const files = (
      JSON.parse(readFileSync('packages/cli/package.json', 'utf8')) as {
        files: string[];
      }
    ).files;
    expect(files).toContain('llms.txt');
  });
});

describe('discovery review round 2', () => {
  it('R2-1: an attached short value before the command works', async () => {
    expect((await invoke('-esnapshot', 'sample', 'examples/bell.ani')).code).toBe(0);
  }, 30000);

  it('R2-2: a section whose slug repeats the page root narrows the page', async () => {
    const whole = await invoke('docs', 'convert');
    const part = await invoke('docs', 'convert', 'convert');
    expect(part.code).toBe(0);
    expect(part.out.length).toBeLessThan(whole.out.length);
  }, 30000);

  it('R2-3: an unknown feature suggests the nearest one', async () => {
    const result = await invoke('features', 'pait', '--format=json');
    expect(result.code).toBe(2);
    expect(JSON.parse(result.err).suggestions).toContain('paint');
  }, 30000);

  it('R2-4, R2-5: schema rejects --all with --json-schema and an empty --search', async () => {
    expect((await invoke('schema', '--all', '--json-schema')).code).toBe(2);
    const empty = await invoke('schema', '--search', '', '--format=json');
    expect(empty.code).toBe(2);
    expect(JSON.parse(empty.err).error).toMatch(/needs at least one word/);
  }, 30000);

  it('R2-6: bash completion finds the command after leading options', () => {
    const bash = completion('bash');
    expect(bash).toMatch(/for \(\( i = 1; i < COMP_CWORD; i\+\+ \)\)/);
    expect(bash).toContain('--format');
  });

  it('R2-7: zsh completes aliases with their command', () => {
    const zsh = completion('zsh');
    expect(zsh).toContain('validate|check|lint)');
    expect(zsh).toContain("'check:");
  });
});
