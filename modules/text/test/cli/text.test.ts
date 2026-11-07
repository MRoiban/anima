import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
for (const args of [
  ['schema', 'text'],
  ['validate', 'modules/text/capabilities/text-wrap/example.animl'],
  ['inspect', 'modules/text/capabilities/text-wrap/example.ani'],
  [
    'sample',
    'modules/text/capabilities/text-wrap/example.ani',
    '--script',
    'spec/conformance/text-wrap/script.txt',
  ],
])
  it('CLI text ' + args[0], () => {
    const result = spawnSync(process.execPath, ['packages/cli/src/main.ts', ...args], {
      encoding: 'utf8',
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    if (args[0] === 'schema') expect(result.stdout).toContain('wordBreak');
  });
