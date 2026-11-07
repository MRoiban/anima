#!/usr/bin/env node
// Load dynamically so a fresh checkout gets actionable setup guidance.
try {
  const { run } = await import('./cli.ts');
  process.exitCode = await run(process.argv.slice(2), {
    write: (s) => process.stdout.write(s),
    out: (s) => process.stdout.write(s + '\n'),
    err: (s) => process.stderr.write(s + '\n'),
  });
} catch (error) {
  if ((error as { code?: string }).code !== 'ERR_MODULE_NOT_FOUND') throw error;
  process.stderr.write('Anima CLI dependencies are missing; run npm ci at the repo root.\n');
  process.exitCode = 2;
}
