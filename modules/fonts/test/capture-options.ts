// Reproduce only these original-font, local native controls. Never read a generated binary.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { featuresFont } from './features-font.ts';
const feature = resolve('tests/oracle/text-opentype-features/rive/feature-fixture.ttf');
writeFileSync(feature, featuresFont());
try {
  for (const name of ['text-variable-axes', 'text-opentype-features']) {
    const cwd = resolve('tests/oracle', name, 'rive');
    mkdirSync(resolve(cwd, 'frames'), { recursive: true });
    try {
      execFileSync(resolve(homedir(), '.rive/bin/rive'), ['.', '--commands=commands.txt'], {
        cwd,
        stdio: 'inherit',
      });
      const output = resolve('tests/oracle', name, 'anima');
      mkdirSync(output, { recursive: true });
      execFileSync(
        process.execPath,
        [
          resolve('packages/cli/src/main.ts'),
          'render',
          resolve('tests/oracle', name, 'case.animl'),
          '--size',
          '240',
          '--background',
          '#ffffff',
          '-o',
          resolve(output, '0.png'),
        ],
        { stdio: 'inherit' },
      );
    } finally {
      for (const file of readdirSync(cwd)) if (file.endsWith('.riv')) rmSync(resolve(cwd, file));
      rmSync(resolve(cwd, 'build'), { recursive: true, force: true });
    }
  }
} finally {
  rmSync(feature, { force: true });
}
