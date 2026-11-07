// Authorized local native capture only. No native binary is read or emitted.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
const cwd = resolve('modules/componentpaint/oracle/live');
const cli = resolve(homedir(), '.rive/bin/rive');
execFileSync(cli, ['.', '--verify'], { cwd, stdio: 'inherit' });
const output = execFileSync(cli, ['.', '--commands=commands.txt'], {
  cwd,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
writeFileSync(resolve(cwd, 'session.txt'), output.trimEnd() + '\n');
