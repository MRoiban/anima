import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMANDS } from '../src/commands.ts';

const ROOT = resolve(import.meta.dirname, '../../..');

describe('generated CLI docs', () => {
  it('is current', () => {
    const result = spawnSync(process.execPath, ['tools/cli-docs.ts', '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
  });

  it('mentions every visible command in both agent entry points', () => {
    const files = [
      readFileSync(resolve(ROOT, 'llms.txt'), 'utf8'),
      readFileSync(resolve(ROOT, 'packages/cli/llms.txt'), 'utf8'),
    ];
    for (const command of COMMANDS.filter((item) => !item.hidden))
      for (const text of files) expect(text).toContain(`anima ${command.name}`);
  });
});
