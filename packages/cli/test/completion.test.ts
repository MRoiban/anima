import { describe, expect, it } from 'vitest';
import { COMMANDS } from '../src/commands.ts';
import { completion } from '../src/completion.ts';

describe('shell completion', () => {
  for (const shell of ['bash', 'zsh', 'fish'] as const)
    it(`${shell} includes commands, flags, choices, subcommands, and topics`, () => {
      const text = completion(shell);
      for (const command of COMMANDS) expect(text).toContain(command.name);
      for (const token of [
        ...(shell === 'fish' ? ['-l size', '-l fit'] : ['--size', '--fit']),
        'contain',
        'cover',
        'update',
        'authoring',
        'rect',
      ])
        expect(text).toContain(token);
    });
});
