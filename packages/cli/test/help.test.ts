import { describe, expect, it } from 'vitest';
import { COMMANDS, GROUPS } from '../src/commands.ts';
import { commandHelp, helpJSON, overview } from '../src/help.ts';
import { run } from '../src/cli.ts';

async function invoke(...args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(args, { out: (text) => out.push(text), err: (text) => err.push(text) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

describe('table-driven help', () => {
  it('groups every visible command and ends with the newcomer entry points', () => {
    const text = overview();
    for (const title of Object.values(GROUPS)) expect(text).toContain(`\n${title}\n`);
    for (const command of COMMANDS.filter((item) => !item.hidden))
      expect(text).toContain(`anima ${command.name}`);
    expect(text.trimEnd().split('\n').slice(-3)).toEqual([
      '  anima features                 what Anima can do',
      '  anima search <words>           find a capability',
      '  anima docs authoring the-loop  follow the authoring loop',
    ]);
  });

  it('wraps overview and command pages to a narrow terminal', () => {
    for (const text of [
      overview(false, 64),
      commandHelp(
        COMMANDS.find((c) => c.name === 'render')!,
        64,
      ),
    ])
      for (const line of text.split('\n')) expect(line.length, line).toBeLessThanOrEqual(64);
  });

  it('serves the same per-command page through help and -h/--help', async () => {
    const expected = (await invoke('help', 'render')).out;
    expect((await invoke('render', '--help')).out).toBe(expected);
    expect((await invoke('render', '-h')).out).toBe(expected);
    expect(expected).toContain('Options:');
    expect(expected).toContain('Examples:');
    expect(expected).toContain('--fit <mode>');
  });

  it('prints overview for bare invocation, help, -h and --help', async () => {
    const expected = (await invoke()).out;
    expect((await invoke('help')).out).toBe(expected);
    expect((await invoke('-h')).out).toBe(expected);
    expect((await invoke('--help')).out).toBe(expected);
  });

  it('serializes the whole table without functions', async () => {
    const direct = JSON.parse(helpJSON());
    const cli = JSON.parse((await invoke('help', '--json')).out);
    expect(cli).toEqual(direct);
    expect(cli.commands.map((command: { name: string }) => command.name)).toEqual(
      COMMANDS.map((command) => command.name),
    );
    expect(
      cli.commands.find((command: { name: string }) => command.name === 'docs').topics,
    ).toContain('authoring');
    expect(
      Array.isArray(
        cli.commands.find((command: { name: string }) => command.name === 'docs').topics,
      ),
    ).toBe(true);
  });
});
