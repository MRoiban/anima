import { spawnSync } from 'node:child_process';
import { changedPaths, selectScope, targetsForChanges } from './test-scope-map.ts';

try {
  const args = process.argv.slice(2);
  const targets: string[] = [];
  let noBrowser = false;
  let browser: string | undefined;
  let base: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--no-browser') noBrowser = true;
    else if (arg.startsWith('--browser=')) browser = arg.slice(10);
    else if (arg.startsWith('--base=')) base = arg.slice(7);
    else if (arg === '--base') {
      base = args[++i];
      if (!base || base.startsWith('-')) throw Error('--base requires a git ref');
    } else if (arg.startsWith('-')) throw Error(`Unknown option: ${arg}`);
    else targets.push(arg);
  }
  if (browser && !['chromium', 'firefox'].includes(browser))
    throw Error('Use --browser=chromium|firefox');
  if (noBrowser && browser) throw Error('--browser and --no-browser cannot be combined');
  if (!targets.length)
    throw Error(
      'Usage: npm run test:scope -- <target…> [--no-browser] [--browser=chromium|firefox] [--base=<ref>]',
    );
  const expanded = targets.flatMap((t) =>
    t === 'changed' ? targetsForChanges(changedPaths(base)) : [t],
  );
  const scope = selectScope(expanded, noBrowser, browser);
  console.log(`Scopes: ${expanded.join(', ') || '(no affected tests)'}`);
  for (const group of ['unit', 'conformance', 'browser'] as const)
    for (const file of scope[group]) console.log(`  ${group}: ${file}`);
  if (scope.conformance.length && scope.casePattern) console.log(`  cases: ${scope.casePattern}`);
  if (browser) console.log(`  browser filter: ${browser}`);
  if (scope.unit.length + scope.browser.length + scope.conformance.length) {
    const result = spawnSync(
      process.execPath,
      ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.scope.config.ts'],
      {
        stdio: 'inherit',
        env: { ...process.env, ANIMA_TEST_SCOPE: JSON.stringify(scope) },
      },
    );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
